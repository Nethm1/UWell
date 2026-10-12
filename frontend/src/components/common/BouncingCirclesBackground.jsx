import React, { useEffect, useMemo, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

/**
 * Decorative background of circles that travel across the whole screen and
 * bounce off its edges, like billiards.
 *
 * Motion is built from native-driven loops plus `interpolate` ping-pong
 * ranges, so each wall bounce is free (no JS callbacks per frame) and the
 * animation runs off the JS thread entirely.
 *
 * Purely ornamental: the layer ignores touches and hides from screen
 * readers. Falls back to a static field when the OS asks to reduce motion.
 */
const BouncingCirclesBackground = ({ circles }) => {
  const { width, height } = useWindowDimensions();

  // Two independent progress loops per circle so the horizontal and vertical
  // motion never falls into a repeating pattern.
  const drivers = useMemo(
    () =>
      (circles || []).map(() => ({
        x: new Animated.Value(0),
        y: new Animated.Value(0),
      })),
    [circles]
  );

  const reduceMotion = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const startLoops = () => {
      if (cancelled || reduceMotion.current) return;
      drivers.forEach((driver, index) => {
        const circle = circles[index] || {};
        const base = circle.period || 9000;
        Animated.loop(
          Animated.timing(driver.x, {
            toValue: 1,
            duration: base,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ).start();
        Animated.loop(
          Animated.timing(driver.y, {
            toValue: 1,
            duration: base * (circle.ratio || 0.63),
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ).start();
      });
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (cancelled) return;
        reduceMotion.current = !!enabled;
        if (enabled) return;
        startLoops();
      })
      // If the query fails, still animate rather than freezing the screen.
      .catch(() => startLoops());

    return () => {
      cancelled = true;
      drivers.forEach((driver) => {
        driver.x.stopAnimation();
        driver.y.stopAnimation();
      });
    };
  }, [drivers, circles]);

  const buildRange = (from, to, bounces) => {
    // Ping-pong across the axis, touching each wall `bounces` times per cycle.
    const steps = Math.max(2, bounces * 2);
    const inputRange = [];
    const outputRange = [];
    for (let i = 0; i <= steps; i += 1) {
      inputRange.push(i / steps);
      outputRange.push(i % 2 === 0 ? from : to);
    }
    return { inputRange, outputRange };
  };

  return (
    <View
      style={styles.layer}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {(circles || []).map((circle, index) => {
        const size = circle.size || 100;
        const left = circle.left || 0;
        const top = circle.top || 0;

        // Range that lets the circle travel from one wall to the other,
        // accounting for its own radius so the edge touches rather than clips.
        const minX = -(left + size / 2);
        const maxX = Math.max(minX, width - (left + size / 2));
        const minY = -(top + size / 2);
        const maxY = Math.max(minY, height - (top + size / 2));

        const xRange = buildRange(minX, maxX, circle.xBounces || 2);
        const yRange = buildRange(minY, maxY, circle.yBounces || 3);

        return (
          <Animated.View
            key={circle.key || index}
            pointerEvents="none"
            style={[
              styles.circle,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                left,
                top,
                backgroundColor: circle.color,
                opacity: circle.opacity ?? 0.14,
              },
              {
                transform: [
                  {
                    translateX: drivers[index].x.interpolate(xRange),
                  },
                  {
                    translateY: drivers[index].y.interpolate(yRange),
                  },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
  },
});

export default BouncingCirclesBackground;