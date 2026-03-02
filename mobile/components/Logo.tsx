import React from 'react'
import { Image, View, StyleSheet } from 'react-native'

type LogoProps = {
  variant?: 'header' | 'login' | 'full'
  style?: object
}

const LOGO_SOURCE = require('../assets/logo_vico.png')

const getHeight = (variant: LogoProps['variant']): number => {
  switch (variant) {
    case 'full':
      return 48
    case 'login':
      return 56
    default:
      return 36
  }
}

const Logo = ({ variant = 'header', style }: LogoProps) => {
  const height = getHeight(variant)

  return (
    <View style={[styles.container, { height }, style]}>
      <Image
        source={LOGO_SOURCE}
        style={{ height }}
        resizeMode="contain"
        accessible
        accessibilityLabel="Vico Türen & Tore"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
})

export default Logo
