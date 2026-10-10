import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Animated,
  Image,
  ScrollView,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const CORAL  = '#EF806B';
const CREAM  = '#FFF9F3';
const DARK   = '#4A3833';
const MUTED  = '#806F68';
const WHITE  = '#FFFFFF';

/* =========================================================
   UWELL LOGO — animated leaves + heart
========================================================= */
function UWellLogo() {
  /* leaf sway refs */
  const leafSwayL = useRef(new Animated.Value(0)).current;
  const leafSwayR = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const swayL = Animated.loop(
      Animated.sequence([
        Animated.timing(leafSwayL, { toValue: 6,  duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(leafSwayL, { toValue: -6, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(leafSwayL, { toValue: 0,  duration: 900,  easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    const swayR = Animated.loop(
      Animated.sequence([
        Animated.timing(leafSwayR, { toValue: -6, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(leafSwayR, { toValue: 6,  duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(leafSwayR, { toValue: 0,  duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    swayL.start();
    swayR.start();
    return () => { swayL.stop(); swayR.stop(); };
  }, []);

  return (
    <Animated.View style={styles.logoCircle}>
      {/* Left leaf — sways */}
      <Animated.View
        style={[
          styles.logoLeaf,
          styles.logoLeafLeft,
          { transform: [{ rotate: '-38deg' }, { translateX: leafSwayL }] },
        ]}
      />
      {/* Right leaf — sways opposite */}
      <Animated.View
        style={[
          styles.logoLeaf,
          styles.logoLeafRight,
          { transform: [{ rotate: '38deg' }, { translateX: leafSwayR }] },
        ]}
      />
      {/* Heart */}
      <Text style={styles.logoHeart}>♡</Text>
      {/* Stem */}
      <View style={styles.logoStem} />
    </Animated.View>
  );
}

/* =========================================================
   WELCOME SCREEN
========================================================= */
const SplashWelcomeScreen = ({ navigation }) => {
  // Expo's native splash is the only startup screen; render the welcome view directly.
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(22)).current;
  const imgScale   = useRef(new Animated.Value(0.92)).current;
  const imgOpacity = useRef(new Animated.Value(0)).current;
  const imgFloat   = useRef(new Animated.Value(0)).current;
  const btnScale   = useRef(new Animated.Value(1)).current;
  const btn2Scale  = useRef(new Animated.Value(1)).current;

  /* welcome entrance */
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,   { toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(slideAnim,  { toValue: 0, duration: 650, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.spring(imgScale,   { toValue: 1, friction: 7, tension: 40, useNativeDriver: true }),
      Animated.timing(imgOpacity, { toValue: 1, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();

    /* floating image loop */
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(imgFloat, { toValue: -5, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(imgFloat, { toValue: 0,  duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(imgFloat, { toValue: 4,  duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(imgFloat, { toValue: 0,  duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    float.start();
    return () => float.stop();
  }, []);

  const pressBtn = (scaleRef, cb) => {
    Animated.sequence([
      Animated.spring(scaleRef, { toValue: 0.96, friction: 5, useNativeDriver: true }),
      Animated.spring(scaleRef, { toValue: 1,    friction: 5, useNativeDriver: true }),
    ]).start(cb);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>

          {/* bg decorations */}
          <View style={styles.bgTR} />
          <View style={styles.bgBL} />
          <View style={styles.bgDotA} />
          <View style={styles.bgDotB} />

          {/* ── HEADER — logo + name ── */}
          <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <UWellLogo />
            <Text style={styles.appName}>UWell</Text>
            <Text style={styles.tagline}>Student Wellness</Text>
          </Animated.View>

          {/* ── IMAGE ── */}
          <Animated.View
            style={[
              styles.imgWrapper,
              { opacity: imgOpacity, transform: [{ translateY: imgFloat }, { scale: imgScale }] },
            ]}
          >
            <View style={styles.imgCard}>
              <View style={styles.imgBgFill} />
              <View style={styles.imgDecorTL} />
              <View style={styles.imgDecorTR} />
              <View style={styles.imgDecorBL} />
              <Image
                source={require('../../assets/images/welcome-student.png')}
                style={styles.studentImg}
                resizeMode="contain"
              />
              <View style={styles.imgGlow} />
            </View>
          </Animated.View>

          {/* ── CONTENT ── */}
          <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

            <Text style={styles.titleLine1}>Your mental health</Text>
            <Text style={styles.titleLine2}>matters</Text>

            <Text style={styles.description}>
              A safe and supportive space for university students to care for their mental
              wellbeing, explore resources, and connect with support.
            </Text>

            <View style={styles.calmRow}>
              <View style={styles.calmDot} />
              <Text style={styles.calmText}>Take a moment for yourself.</Text>
            </View>

            {/* buttons */}
            <View style={styles.btnsContainer}>

              {/* secondary — already have account */}
              <Animated.View style={[styles.btnWrap, { transform: [{ scale: btn2Scale }] }]}>
                <Pressable
                  style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => pressBtn(btn2Scale, () => navigation.navigate('Login'))}
                >
                  <Text style={styles.secondaryBtnText}>I already have an account</Text>
                </Pressable>
              </Animated.View>

              {/* primary — get started */}
              <Animated.View style={[styles.btnWrap, { transform: [{ scale: btnScale }] }]}>
                <Pressable
                  style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.88 }]}
                  onPress={() => pressBtn(btnScale, () => navigation.navigate('Consent'))}
                >
                  <Text style={styles.primaryBtnText}>Get Started</Text>
                  <View style={styles.arrowCircle}>
                    <Text style={styles.arrowText}>›</Text>
                  </View>
                </Pressable>
              </Animated.View>

            </View>

            {/* privacy note */}
            <View style={styles.privacyRow}>
              <Text style={styles.privacyLock}>🔒</Text>
              <Text style={styles.privacyNote}>Your privacy and confidentiality matter to us.</Text>
            </View>

          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SplashWelcomeScreen;

/* =========================================================
   STYLES
========================================================= */
const styles = StyleSheet.create({

  /* ── SPLASH ── */
  /* logo */
  logoCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: CORAL,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
    shadowColor: CORAL, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 10, elevation: 6,
  },
  logoLeaf: {
    position: 'absolute', width: 11, height: 21, backgroundColor: WHITE,
    borderTopLeftRadius: 11, borderTopRightRadius: 3,
    borderBottomLeftRadius: 3, borderBottomRightRadius: 11, opacity: 0.95,
  },
  logoLeafLeft:  { left: 16, top: 15 },
  logoLeafRight: { right: 16, top: 15 },
  logoHeart: {
    position: 'absolute', color: CORAL, fontSize: 17,
    fontWeight: '700', zIndex: 5, top: 21,
  },
  logoStem: {
    position: 'absolute', width: 3, height: 13,
    backgroundColor: WHITE, bottom: 12, borderRadius: 2,
  },

  /* ── WELCOME ── */
  safeArea:     { flex: 1, backgroundColor: CREAM },
  scrollContent: { flexGrow: 1 },
  container: {
    flexGrow: 1, alignItems: 'center',
    paddingHorizontal: 22, paddingTop: 4, paddingBottom: 24,
    position: 'relative', overflow: 'hidden',
  },

  /* bg blobs */
  bgTR: {
    position: 'absolute', width: 190, height: 190, borderRadius: 95,
    backgroundColor: '#FBE9E1', top: -110, right: -88, opacity: 0.6,
  },
  bgBL: {
    position: 'absolute', width: 170, height: 170, borderRadius: 85,
    backgroundColor: '#EDF3EC', bottom: -110, left: -88, opacity: 0.75,
  },
  bgDotA: {
    position: 'absolute', width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#E4C7B8', top: 140, left: 22, opacity: 0.5,
  },
  bgDotB: {
    position: 'absolute', width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#C9DCC7', top: 200, right: 26, opacity: 0.65,
  },

  /* header */
  header: { alignItems: 'center', marginTop: 4 },
  appName: { fontSize: 28, fontWeight: '800', color: DARK, marginTop: 6 },
  tagline: { fontSize: 11, color: '#A18479', letterSpacing: 1.1, marginTop: 2 },

  /* image */
  imgWrapper: {
    width: Math.min(width * 0.9, 360),
    aspectRatio: 1.4,
    marginTop: 16,
  },
  imgCard: {
    flex: 1, borderRadius: 26, backgroundColor: '#F0E6DE',
    overflow: 'hidden', position: 'relative',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#EDD8CE',
    shadowColor: '#C4A89A', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12, shadowRadius: 14, elevation: 4,
  },
  imgBgFill: {
    position: 'absolute', width: '100%', height: '100%', backgroundColor: '#F0E6DE',
  },
  imgDecorTL: {
    position: 'absolute', width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#DCE8D9', top: 14, left: 14, opacity: 0.8, zIndex: 2,
  },
  imgDecorTR: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#EBD9CC', top: 18, right: 16, opacity: 0.8, zIndex: 2,
  },
  imgDecorBL: {
    position: 'absolute', width: 18, height: 18, borderRadius: 9,
    backgroundColor: WHITE, bottom: 18, left: 18, opacity: 0.7, zIndex: 2,
  },
  studentImg: { width: '100%', height: '100%', zIndex: 3 },
  imgGlow: {
    position: 'absolute', width: '75%', height: 32, borderRadius: 20,
    bottom: -14, backgroundColor: '#D9C0B4', opacity: 0.18, zIndex: 1,
  },

  /* content */
  content: { width: '100%', alignItems: 'center', marginTop: 4 },
  titleLine1: {
    fontSize: 28, lineHeight: 34, fontWeight: '800',
    color: DARK, textAlign: 'center', marginTop: 14,
  },
  titleLine2: {
    fontSize: 28, lineHeight: 34, fontWeight: '800',
    color: DARK, textAlign: 'center',
  },
  description: {
    fontSize: 13, lineHeight: 19, color: MUTED,
    textAlign: 'center', marginTop: 9, paddingHorizontal: 6,
  },
  calmRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginTop: 9,
  },
  calmDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: CORAL, marginRight: 7, opacity: 0.85,
  },
  calmText: { fontSize: 11, color: '#9A8178', fontWeight: '500' },

  /* buttons */
  btnsContainer: { width: '100%', marginTop: 20 },
  btnWrap: { width: '100%', marginBottom: 11 },
  secondaryBtn: {
    width: '100%', height: 52, borderRadius: 26,
    backgroundColor: '#F3E8E2', borderWidth: 1, borderColor: '#E9D8D0',
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { color: DARK, fontSize: 15, fontWeight: '700' },
  primaryBtn: {
    width: '100%', height: 54, borderRadius: 27,
    backgroundColor: CORAL, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: CORAL, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22, shadowRadius: 10, elevation: 4,
  },
  primaryBtnText: { color: WHITE, fontSize: 16, fontWeight: '700' },
  arrowCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center', marginLeft: 10,
  },
  arrowText: {
    color: WHITE, fontSize: 24, fontWeight: '400',
    lineHeight: 25, textAlign: 'center', marginTop: -2,
  },

  /* privacy */
  privacyRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginTop: 4,
  },
  privacyLock: { fontSize: 12, marginRight: 5 },
  privacyNote: { fontSize: 10, color: '#9A8780', textAlign: 'center' },
});
