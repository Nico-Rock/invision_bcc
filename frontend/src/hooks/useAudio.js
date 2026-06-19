import { useContext } from 'react';
import { AudioContext } from '../context/AudioContext';

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio debe ser utilizado dentro de un AudioProvider');
  }
  return context;
};
