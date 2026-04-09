import React from 'react';
import { Modal, View, StyleSheet, Pressable, Dimensions, Animated } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const { width, height } = Dimensions.get('window');

interface ImagePopupProps {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
  fullscreen?: boolean;
}

export const ImagePopup = ({ visible, imageUri, onClose, fullscreen = false }: ImagePopupProps) => {
  const scaleAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible]);

  if (!imageUri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
        <Animated.View style={[
          fullscreen ? styles.fullscreenContainer : styles.avatarContainer,
          { transform: [{ scale: scaleAnim }] }
        ]}>
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            contentFit={fullscreen ? 'contain' : 'cover'}
            cachePolicy="memory-disk"
          />
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <MaterialIcons name="close" size={22} color="white" />
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  fullscreenContainer: {
    width: width,
    height: height * 0.75,
    backgroundColor: 'black',
  },
  avatarContainer: {
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: (width * 0.8) / 2,
    borderWidth: 4,
    borderColor: colors.primary,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerLow,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 6,
  }
});
