import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { colors, spacing } from '../../theme';
import Button from '../../components/common/Button';

const LoadingScreen = ({ onGetStarted }) => (
  <View style={styles.container}>
    <Image
      source={require('../../assets/images/loadingscreen.png')}
      style={styles.image}
      resizeMode="contain"
      accessibilityLabel="UWell counseling illustration"
    />
    <Button
      title="Get Started"
      onPress={onGetStarted}
      style={styles.button}
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  image: {
    width: '100%',
    height: 400,
    marginBottom: spacing.xl,
  },
  button: {
    width: '100%',
    marginTop: spacing.lg,
  },
});

export default LoadingScreen;
