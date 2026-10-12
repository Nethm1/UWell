import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { counselorService } from '../../services/counselorService';
import { useAuth } from '../../context/AuthContext';
import { connectSocket } from '../../services/socketService';
import { appointmentDateTime, formatCountdown } from '../../utils/counselorAppointments';

const C = {
  page: '#FFF8F2',
  white: '#FFFFFF',
  ink: '#24232A',
  muted: '#6F737E',
  coral: '#EF6553',
  coralDark: '#D94F40',
  peach: '#FCE7DE',
  peachSoft: '#FFF0EA',
  line: '#F1E8E2',
  green: '#28734D',
  greenBg: '#E1F4E7',
  amber: '#B96700',
  amberBg: '#FFF0D8',
};

const initialsFor = (name = '') => name
  .split(/[\s,]+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase() || 'CC';

const greetingForNow = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
};

const getFirstName = (name = '') => name
  .split(/[\s,]+/)
  .filter((part) => part && !/^(dr\.?|prof\.?|phd|md)$/i.test(part))[0] || 'Counselor';

const formatNoteDate = (student, appointments) => {
  const savedAt = student.sessionNoteUpdatedAt || student.updatedAt || student.lastSessionDate;
  if (savedAt) {
    const date = new Date(savedAt);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  }

  const relatedAppointment = appointments.find((item) => item.studentId === student.id);
  return relatedAppointment?.date || 'Recent note';
};

const SectionTitle = ({ title, onPress, action = 'View all' }) => (
  <View style={styles.sectionHeading}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {onPress ? (
      <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={action} activeOpacity={0.72}>
        <Text style={styles.sectionAction}>{action}<Text style={styles.actionArrow}>  ›</Text></Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const Avatar = ({ initials, size = 48, imageUri }) => (
  <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    {imageUri ? (
      <Image source={{ uri: imageUri }} style={styles.avatarImage} resizeMode="cover" accessibilityLabel="Counselor profile photo" />
    ) : (
      <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>{initials}</Text>
    )}
  </View>
);

const AnimatedCounter = ({ value, tone, compact }) => {
  const count = useRef(new Animated.Value(0)).current;
  const numericValue = Number(value);
  const [displayValue, setDisplayValue] = useState(Number.isFinite(numericValue) ? 0 : value);

  useEffect(() => {
    if (!Number.isFinite(numericValue)) {
      setDisplayValue(value);
      return undefined;
    }

    count.setValue(0);
    const listener = count.addListener(({ value: nextValue }) => setDisplayValue(Math.round(nextValue)));
    const animation = Animated.timing(count, {
      toValue: numericValue,
      duration: 760,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();

    return () => {
      animation.stop();
      count.removeListener(listener);
    };
  }, [count, numericValue, value]);

  return (
    <Text style={[
      styles.statValue,
      compact && styles.statValueCompact,
      tone === 'amber' && styles.statValueAmber,
    ]}>
      {displayValue}
    </Text>
  );
};

const AnimatedChartBar = ({ height, index, compact }) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 520,
      delay: index * 55,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [index, progress]);

  const barHeight = compact ? height * 0.7 : height;
  return (
    <Animated.View
      style={[
        styles.sparkBar,
        compact && styles.sparkBarCompact,
        {
          height: progress.interpolate({ inputRange: [0, 1], outputRange: [2, barHeight] }),
          opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.65] }),
        },
      ]}
    />
  );
};

const StatCard = ({ icon, value, label, tone = 'coral', compact }) => (
  <View style={[styles.statCard, compact && styles.statCardCompact]}>
    <View style={[styles.statIcon, compact && styles.statIconCompact, tone === 'amber' && styles.statIconAmber]}>{icon}</View>
    <AnimatedCounter value={value} tone={tone} compact={compact} />
    <Text style={[styles.statLabel, compact && styles.statLabelCompact]}>{label}</Text>
    <View style={[styles.sparkline, compact && styles.sparklineCompact]}>
      {[12, 8, 10, 16, 12, 20, 15].map((height, index) => (
        <AnimatedChartBar key={index} height={height} index={index} compact={compact} />
      ))}
    </View>
  </View>
);

const SessionCard = ({ item, student, onPress, compact, countdown }) => {
  const confirmed = String(item.status || '').toLowerCase() === 'confirmed';
  const name = item.studentName || student?.name || 'Student';
  const course = item.studentCourse || student?.yearCourse || 'Student support session';
  const location = item.location || item.sessionType || 'Counseling session';

  return (
    <TouchableOpacity style={[styles.sessionCard, compact && styles.sessionCardCompact]} onPress={onPress} activeOpacity={0.82}>
      <Avatar initials={item.avatarInitials || initialsFor(name)} size={compact ? 44 : 54} />
      <View style={styles.sessionInfo}>
        <Text style={styles.studentName} numberOfLines={1}>{name}</Text>
        <Text style={styles.studentCourse} numberOfLines={1}>{course}</Text>
        <View style={styles.sessionMeta}>
          <Feather name="calendar" size={14} color={C.coral} />
          <Text style={styles.metaText}>{item.date || 'Upcoming'} · {item.time || 'Time to be confirmed'}</Text>
        </View>
        <View style={styles.sessionMeta}>
          <Feather name={/video|online/i.test(location) ? 'video' : 'map-pin'} size={14} color={C.coral} />
          <Text style={styles.metaText} numberOfLines={1}>{location}</Text>
        </View>
        {countdown ? <Text style={styles.countdownText}>{countdown}</Text> : null}
      </View>
        <View style={styles.sessionRight}>
          <View style={[styles.statusPill, compact && styles.statusPillCompact, confirmed ? styles.confirmedPill : styles.pendingPill]}>
          <Ionicons
            name={confirmed ? 'checkmark-circle' : 'time-outline'}
            size={14}
            color={confirmed ? C.green : C.amber}
          />
          <Text style={[styles.statusText, confirmed ? styles.confirmedText : styles.pendingText]}>
            {confirmed ? 'Confirmed' : (item.status || 'Pending')}
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={C.muted} />
      </View>
    </TouchableOpacity>
  );
};

const DashboardScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const compact = screenWidth < 430;
  const entranceOpacity = useRef(new Animated.Value(0)).current;
  const entranceY = useRef(new Animated.Value(12)).current;
  const heroFloat = useRef(new Animated.Value(0)).current;
  const onlinePulse = useRef(new Animated.Value(0.45)).current;
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [students, setStudents] = useState([]);
  const [callAvailable, setCallAvailable] = useState(true);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const socket = connectSocket();
    const readAvailability = () => socket.timeout(7000).emit('check-call-availability', (error, result) => {
      if (!error && typeof result?.available === 'boolean') setCallAvailable(result.available);
    });
    socket.on('connect', readAvailability);
    if (socket.connected) readAvailability();
    return () => socket.off('connect', readAvailability);
  }, []);

  const toggleCallAvailability = (available) => {
    const socket = connectSocket();
    setAvailabilitySaving(true);
    socket.timeout(7000).emit('set-call-availability', { available }, (error, result) => {
      if (!error && result?.ok) setCallAvailable(result.available);
      else socket.timeout(7000).emit('check-call-availability', (readError, snapshot) => {
        if (!readError && typeof snapshot?.available === 'boolean') setCallAvailable(snapshot.available);
      });
      setAvailabilitySaving(false);
    });
  };

  const loadDashboardData = useCallback(async () => {
    const [profileResult, statsResult, appointmentsResult, studentsResult] = await Promise.allSettled([
      counselorService.getCounselorProfile(),
      counselorService.getPerformanceStats(),
      counselorService.getAppointments(),
      counselorService.getStudents(),
    ]);

    if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
    if (statsResult.status === 'fulfilled') setStats(statsResult.value);
    if (appointmentsResult.status === 'fulfilled') {
      const data = appointmentsResult.value;
      setAppointments(Array.isArray(data) ? data : data?.appointments || []);
    }
    if (studentsResult.status === 'fulfilled') {
      const data = studentsResult.value;
      setStudents(Array.isArray(data) ? data : data?.students || []);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    const unsubscribe = navigation.addListener('focus', loadDashboardData);
    return unsubscribe;
  }, [loadDashboardData, navigation]);

  useEffect(() => {
    const entrance = Animated.parallel([
      Animated.timing(entranceOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(entranceY, { toValue: 0, speed: 18, bounciness: 2, useNativeDriver: true }),
    ]);
    entrance.start();
    return () => entrance.stop();
  }, [entranceOpacity, entranceY]);

  useEffect(() => {
    const heroLoop = Animated.loop(Animated.sequence([
      Animated.timing(heroFloat, { toValue: -3, duration: 2200, useNativeDriver: true }),
      Animated.timing(heroFloat, { toValue: 0, duration: 2200, useNativeDriver: true }),
    ]));
    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(onlinePulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
      Animated.timing(onlinePulse, { toValue: 0.45, duration: 1100, useNativeDriver: true }),
    ]));
    heroLoop.start();
    pulseLoop.start();
    return () => {
      heroLoop.stop();
      pulseLoop.stop();
    };
  }, [heroFloat, onlinePulse]);

  const fullName = profile?.name || user?.name || user?.fullName || 'Counselor';
  const firstName = getFirstName(fullName);
  const initials = profile?.avatarInitials || initialsFor(fullName);
  const sortedAppointments = useMemo(() => appointments
    .filter((item) => {
      if (['cancelled', 'completed'].includes(String(item.status || '').toLowerCase())) return false;
      const dateTime = appointmentDateTime(item, now);
      return !dateTime || dateTime >= now;
    })
    .sort((a, b) => (appointmentDateTime(a, now)?.getTime() ?? Infinity) - (appointmentDateTime(b, now)?.getTime() ?? Infinity)), [appointments, now]);
  const nextAppointment = useMemo(() => sortedAppointments
    .map((item) => ({ item, dateTime: appointmentDateTime(item, now) }))
    .filter(({ dateTime }) => dateTime && dateTime >= now)
    .sort((a, b) => a.dateTime - b.dateTime)[0], [sortedAppointments, now]);
  const notificationCount = appointments.filter((item) => String(item.status || '').toLowerCase() === 'pending').length;
  const todayCount = appointments.filter((item) => String(item.date || '').toLowerCase() === 'today').length;
  const recentNotes = students
    .filter((student) => typeof student.sessionNotesHistory === 'string' && student.sessionNotesHistory.trim())
    .slice(0, 2);

  const openStudentSession = (item) => navigation.navigate('Students', {
    screen: 'StudentSession',
    params: { studentId: item.studentId, appointment: item },
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.page} />
      <Animated.ScrollView
        style={[styles.scroll, { opacity: entranceOpacity, transform: [{ translateY: entranceY }] }]}
        contentContainerStyle={[styles.content, compact && styles.contentCompact]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={[styles.topRow, compact && styles.topRowCompact]}>
          <View style={styles.greetingBlock}>
            <Text style={styles.staffBadge}>CLINICAL STAFF</Text>
            <Text style={styles.greeting}>{greetingForNow()}</Text>
            <Text style={[styles.nameLine, compact && styles.nameLineCompact]} numberOfLines={1} adjustsFontSizeToFit>
              {firstName} <Ionicons name="partly-sunny-outline" size={compact ? 22 : 26} color="#EBA340" />
            </Text>
            <Text style={[styles.welcomeText, compact && styles.welcomeTextCompact]}>Thank you for being here and supporting your students.</Text>
          </View>
          <View style={[styles.topActions, compact && styles.topActionsCompact]}>
            <TouchableOpacity
              style={[styles.bellButton, compact && styles.bellButtonCompact]}
              onPress={() => navigation.navigate('Profile', { screen: 'CounselorNotifications' })}
              accessibilityRole="button"
              accessibilityLabel="Open messages"
              activeOpacity={0.72}
            >
              <Feather name="bell" size={22} color={C.coral} />
              {notificationCount > 0 ? <View style={styles.notificationCount}><Text style={styles.notificationCountText}>{notificationCount > 9 ? '9+' : notificationCount}</Text></View> : null}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')} accessibilityRole="button" accessibilityLabel="Open profile" activeOpacity={0.72}>
              <Avatar initials={initials} size={compact ? 50 : 58} imageUri={profile?.profileImage} />
              <Animated.View style={[styles.onlineDot, { opacity: onlinePulse }]} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.impactCard, compact && styles.impactCardCompact]}>
          <View style={[styles.impactCopy, compact && styles.impactCopyCompact]}>
            <Text style={[styles.impactTitle, compact && styles.impactTitleCompact]}>Today, you’re{ '\n' }making a difference</Text>
            <Text style={[styles.impactSub, compact && styles.impactSubCompact]}>Your support helps students build a healthier, brighter tomorrow.</Text>
            <View style={[styles.supportCount, compact && styles.supportCountCompact]}>
              <View style={[styles.supportIcon, compact && styles.supportIconCompact]}><Ionicons name="people" size={20} color={C.coral} /></View>
              <View>
                <Text style={styles.supportNumber}>{todayCount}</Text>
                <Text style={[styles.supportLabel, compact && styles.supportLabelCompact]}>
                  {compact ? 'students today' : 'students supported today'}
                </Text>
              </View>
            </View>
          </View>
          <Animated.Image
            source={require('../../../assets/counseling-session.jpg')}
            style={[styles.impactImage, compact && styles.impactImageCompact, { transform: [{ translateY: heroFloat }] }]}
            resizeMode="cover"
            accessibilityLabel="Counselor supporting a student"
          />
          <View style={[styles.impactImageTint, compact && styles.impactImageTintCompact]} />
          {!compact && <View style={styles.heartBubble}><Ionicons name="heart" size={21} color={C.coral} /></View>}
        </View>

        <View style={[styles.availabilityCard, compact && styles.availabilityCardCompact]}>
          <View style={[styles.availabilityDetails, compact && styles.availabilityDetailsCompact]}>
            <View style={[styles.availabilityIcon, compact && styles.availabilityIconCompact]}><MaterialCommunityIcons name="calendar-clock" size={26} color={C.coral} /></View>
            <View style={styles.availabilityCopy}>
              <Text style={[styles.availabilityTitle, compact && styles.availabilityTitleCompact]}>Availability</Text>
              <Text style={[styles.availabilitySub, compact && styles.availabilitySubCompact]}>Manage your office hours and open slots.</Text>
              <View style={styles.callAvailabilityRow}>
                <View style={[styles.callAvailabilityDot, callAvailable && styles.callAvailabilityDotOn]} />
                <Text style={styles.callAvailabilityText}>{callAvailable ? 'Available for video calls' : 'Not available for video calls'}</Text>
                <Switch
                  value={callAvailable}
                  onValueChange={toggleCallAvailability}
                  disabled={availabilitySaving}
                  trackColor={{ false: '#D7DCE2', true: '#A8D7B9' }}
                  thumbColor={callAvailable ? C.green : '#8B929B'}
                  accessibilityLabel="Toggle availability for video calls"
                />
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.manageButton, compact && styles.manageButtonCompact]}
            onPress={() => navigation.navigate('Availability')}
            accessibilityRole="button"
            activeOpacity={0.82}
          >
            <Text style={styles.manageButtonText}>{compact ? 'Manage Slots' : 'Manage availability'}</Text>
            <Feather name="arrow-right" size={17} color={C.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Your week</Text>
          <View style={styles.weekPill}><Text style={styles.weekText}>This week</Text><Feather name="chevron-down" size={16} color={C.ink} /></View>
        </View>
        <View style={[styles.statsRow, compact && styles.statsRowCompact]}>
          <StatCard
            compact={compact}
            icon={<Ionicons name="people-outline" size={21} color={C.coral} />}
            value={stats?.activeCases ?? 1}
            label="Active cases"
          />
          <StatCard
            compact={compact}
            icon={<Feather name="calendar" size={20} color={C.coral} />}
            value={stats?.thisWeekSessions ?? sortedAppointments.length}
            label="Upcoming sessions"
          />
          <StatCard
            compact={compact}
            tone="amber"
            icon={<Feather name="file-text" size={20} color="#DB7A13" />}
            value={stats?.pendingRequests ?? 2}
            label="Notes to review"
          />
        </View>

        <SectionTitle title="Upcoming sessions" onPress={() => navigation.navigate('Appointments')} />
        {sortedAppointments.length ? sortedAppointments.slice(0, 2).map((item) => {
          const student = students.find((entry) => entry.id === item.studentId);
          return (
            <SessionCard
              key={item.id}
              item={item}
              student={student}
              compact={compact}
              countdown={nextAppointment?.item.id === item.id ? `Starts in ${formatCountdown(nextAppointment.dateTime - now)}` : null}
              onPress={() => openStudentSession(item)}
            />
          );
        }) : (
          <View style={styles.emptyCard}>
            <Feather name="calendar" size={21} color={C.coral} />
            <Text style={styles.emptyText}>No upcoming sessions scheduled.</Text>
          </View>
        )}

        <SectionTitle title="Recent session notes" onPress={() => navigation.navigate('Students')} />
        {recentNotes.length ? recentNotes.map((student) => (
          <TouchableOpacity
            key={student.id}
            style={styles.noteCard}
            activeOpacity={0.82}
            onPress={() => navigation.navigate('Students', {
              screen: 'StudentSession',
              params: { studentId: student.id },
            })}
          >
            <Avatar initials={student.avatarInitials || initialsFor(student.name)} size={compact ? 44 : 54} />
            <View style={styles.noteInfo}>
              <Text style={styles.studentName}>{student.name}</Text>
              <Text style={styles.studentCourse}>{student.yearCourse || 'Student'}</Text>
              <View style={styles.noteDateRow}>
                <Feather name="clock" size={12} color={C.muted} />
                <Text style={styles.noteDate}>{formatNoteDate(student, appointments)}</Text>
              </View>
              <View style={styles.sessionMeta}>
                <Feather name="lock" size={14} color={C.coral} />
                <Text style={styles.noteText} numberOfLines={2}>{student.sessionNotesHistory}</Text>
              </View>
            </View>
            <View style={[styles.securePill, compact && styles.securePillCompact]}><Feather name="lock" size={13} color={C.green} />{!compact && <Text style={styles.secureText}>Secure note</Text>}</View>
            <Feather name="chevron-right" size={19} color={C.muted} />
          </TouchableOpacity>
        )) : (
          <View style={styles.emptyCard}><Feather name="lock" size={19} color={C.muted} /><Text style={styles.emptyText}>No session notes to review yet.</Text></View>
        )}
        <View style={styles.bottomSpace} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.page },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 700, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 26 },
  contentCompact: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 44 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  topRowCompact: { marginBottom: 15 },
  greetingBlock: { flex: 1, paddingRight: 10 },
  staffBadge: { alignSelf: 'flex-start', backgroundColor: C.peach, color: C.coralDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, overflow: 'hidden', marginBottom: 11 },
  greeting: { color: '#30333D', fontSize: 24, lineHeight: 29, fontWeight: '700' },
  nameLine: { color: C.coralDark, fontSize: 31, lineHeight: 37, fontWeight: '800' },
  nameLineCompact: { fontSize: 27, lineHeight: 33 },
  weather: { fontSize: 26 },
  welcomeText: { color: C.muted, fontSize: 15, lineHeight: 21, marginTop: 4, maxWidth: 290 },
  welcomeTextCompact: { fontSize: 13, lineHeight: 18 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 7 },
  topActionsCompact: { gap: 8 },
  bellButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  bellButtonCompact: { width: 42, height: 42, borderRadius: 21 },
  notificationCount: { position: 'absolute', right: -1, top: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  notificationCountText: { color: C.white, fontSize: 11, fontWeight: '800' },
  avatar: { backgroundColor: '#FCE1D7', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.white, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: C.coralDark, fontWeight: '800' },
  onlineDot: { position: 'absolute', right: -1, bottom: 0, width: 15, height: 15, borderRadius: 8, backgroundColor: '#39B96B', borderWidth: 2, borderColor: C.white },
  impactCard: { minHeight: 242, borderRadius: 25, backgroundColor: '#FBE3D8', overflow: 'hidden', marginBottom: 16, position: 'relative', justifyContent: 'center' },
  impactCopy: { width: '63%', zIndex: 2, paddingVertical: 22, paddingLeft: 22, paddingRight: 4 },
  impactCardCompact: { minHeight: 232, borderRadius: 22 },
  impactCopyCompact: { width: '62%', paddingVertical: 17, paddingLeft: 15, paddingRight: 3 },
  impactTitle: { color: '#421B25', fontSize: 25, lineHeight: 31, fontWeight: '800', marginBottom: 8 },
  impactTitleCompact: { fontSize: 21, lineHeight: 26, marginBottom: 6 },
  impactSub: { color: '#796D70', fontSize: 14, lineHeight: 19, marginBottom: 15, maxWidth: 250 },
  impactSubCompact: { fontSize: 12, lineHeight: 16, marginBottom: 10 },
  supportCount: { alignSelf: 'flex-start', minWidth: 188, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12 },
  supportCountCompact: { width: '100%', minWidth: 0, paddingVertical: 6, paddingHorizontal: 7, borderRadius: 15 },
  supportIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  supportIconCompact: { width: 30, height: 30, marginRight: 6 },
  supportNumber: { color: C.ink, fontSize: 20, fontWeight: '800' },
  supportLabel: { color: C.muted, fontSize: 11, marginTop: 1 },
  supportLabelCompact: { fontSize: 9, lineHeight: 12 },
  impactImage: { position: 'absolute', right: 0, bottom: 0, width: '43%', height: '100%', borderTopRightRadius: 25, borderBottomRightRadius: 25 },
  impactImageCompact: { width: '38%', opacity: 0.82, borderTopRightRadius: 22, borderBottomRightRadius: 22 },
  impactImageTint: { position: 'absolute', right: 0, bottom: 0, width: '43%', height: '100%', backgroundColor: 'rgba(250, 155, 128, 0.20)' },
  impactImageTintCompact: { width: '38%', backgroundColor: 'rgba(250, 155, 128, 0.14)' },
  heartBubble: { position: 'absolute', top: 34, right: '36%', width: 43, height: 43, borderRadius: 22, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  availabilityCard: { minHeight: 110, flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, padding: 15, borderRadius: 23, marginBottom: 21, gap: 12 },
  availabilityCardCompact: { flexDirection: 'column', alignItems: 'stretch', padding: 13, gap: 12, borderRadius: 20 },
  availabilityDetails: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  availabilityDetailsCompact: { flex: 0, alignItems: 'center', gap: 10 },
  availabilityIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.peachSoft, alignItems: 'center', justifyContent: 'center' },
  availabilityIconCompact: { width: 52, height: 52, borderRadius: 26 },
  availabilityCopy: { flex: 1 },
  callAvailabilityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  callAvailabilityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#A4AAB2' },
  callAvailabilityDotOn: { backgroundColor: C.green },
  callAvailabilityText: { flex: 1, color: C.muted, fontSize: 11, fontWeight: '700' },
  availabilityTitle: { color: C.ink, fontSize: 19, fontWeight: '800', marginBottom: 3 },
  availabilityTitleCompact: { fontSize: 17 },
  availabilitySub: { color: C.muted, fontSize: 12, lineHeight: 17 },
  availabilitySubCompact: { fontSize: 11, lineHeight: 15 },
  manageButton: { minHeight: 48, paddingHorizontal: 14, borderRadius: 25, backgroundColor: C.coral, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  manageButtonCompact: { width: '100%', minHeight: 44, borderRadius: 22 },
  manageButtonText: { color: C.white, fontSize: 12, fontWeight: '700' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5, marginBottom: 12 },
  sectionTitle: { color: C.ink, fontSize: 21, fontWeight: '800' },
  sectionAction: { color: C.coral, fontSize: 14, fontWeight: '700' },
  actionArrow: { fontSize: 21 },
  weekPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.white, borderRadius: 22 },
  weekText: { color: C.ink, fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  statsRowCompact: { gap: 7, marginBottom: 19 },
  statCard: { flex: 1, minHeight: 142, backgroundColor: C.white, borderRadius: 21, padding: 12, overflow: 'hidden' },
  statCardCompact: { minHeight: 132, padding: 9, borderRadius: 18 },
  statIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.peachSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statIconCompact: { width: 36, height: 36, borderRadius: 18 },
  statIconAmber: { backgroundColor: '#FFF1DC' },
  statValue: { color: C.coral, fontSize: 25, lineHeight: 29, fontWeight: '800' },
  statValueCompact: { fontSize: 22, lineHeight: 26 },
  statValueAmber: { color: '#DB7A13' },
  statLabel: { color: C.muted, fontSize: 11, lineHeight: 15, minHeight: 29 },
  statLabelCompact: { fontSize: 10, lineHeight: 13, minHeight: 27 },
  sparkline: { flexDirection: 'row', height: 22, alignItems: 'flex-end', gap: 4, marginTop: 5 },
  sparklineCompact: { gap: 2, height: 18, marginTop: 3 },
  sparkBar: { width: 8, borderRadius: 4, backgroundColor: C.coral },
  sparkBarCompact: { width: 6 },
  sessionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, padding: 13, borderRadius: 20, marginBottom: 11, gap: 11 },
  sessionCardCompact: { padding: 10, gap: 8, borderRadius: 18 },
  sessionInfo: { flex: 1, minWidth: 0 },
  studentName: { color: C.ink, fontSize: 15, fontWeight: '800', marginBottom: 2 },
  studentCourse: { color: C.muted, fontSize: 12, marginBottom: 5 },
  noteDateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  noteDate: { color: C.muted, fontSize: 10 },
  sessionMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  metaText: { color: C.muted, fontSize: 11, flexShrink: 1 },
  countdownText: { color: C.coralDark, fontSize: 10, fontWeight: '800', marginTop: 7 },
  sessionRight: { alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 16 },
  confirmedPill: { backgroundColor: C.greenBg },
  pendingPill: { backgroundColor: C.amberBg },
  statusText: { fontSize: 10, fontWeight: '700' },
  statusPillCompact: { paddingHorizontal: 6, paddingVertical: 5, gap: 3 },
  confirmedText: { color: C.green },
  pendingText: { color: C.amber },
  emptyCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.white, borderRadius: 18, marginBottom: 12, padding: 14 },
  emptyText: { color: C.muted, fontSize: 13 },
  noteCard: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: C.white, borderRadius: 20, padding: 13, marginBottom: 11 },
  noteInfo: { flex: 1, minWidth: 0 },
  noteText: { color: C.ink, fontSize: 11, lineHeight: 15, flexShrink: 1 },
  securePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 18, backgroundColor: C.greenBg },
  secureText: { color: C.green, fontSize: 10, fontWeight: '700' },
  securePillCompact: { paddingHorizontal: 7, paddingVertical: 7 },
  bottomSpace: { height: 12 },
});

export default DashboardScreen;
