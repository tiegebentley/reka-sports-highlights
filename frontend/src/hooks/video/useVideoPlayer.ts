import { useRef, useEffect, useState, useCallback } from 'react';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';

// Temporary workaround for browser cache issue
interface VideoPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isFullscreen: boolean;
}

export interface UseVideoPlayerOptions {
  autoplay?: boolean;
  controls?: boolean;
  responsive?: boolean;
  fluid?: boolean;
  sources?: Array<{ src: string; type: string }>;
  onReady?: (player: Player) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
}

export const useVideoPlayer = (options: UseVideoPlayerOptions = {}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Player | null>(null);

  const [playerState, setPlayerState] = useState<VideoPlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    playbackRate: 1,
    isFullscreen: false,
  });

  // Initialize Video.js player
  useEffect(() => {
    if (!videoRef.current) return;

    const player = videojs(videoRef.current, {
      autoplay: options.autoplay || false,
      controls: options.controls !== false,
      responsive: options.responsive !== false,
      fluid: options.fluid !== false,
      sources: options.sources || [],
      controlBar: {
        volumePanel: { inline: false },
        pictureInPictureToggle: false,
      },
    });

    playerRef.current = player;

    // Event listeners
    player.on('ready', () => {
      if (options.onReady) {
        options.onReady(player);
      }
      setPlayerState(prev => ({
        ...prev,
        duration: player.duration() || 0,
      }));
    });

    player.on('play', () => {
      setPlayerState(prev => ({ ...prev, isPlaying: true }));
    });

    player.on('pause', () => {
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
    });

    player.on('timeupdate', () => {
      const currentTime = player.currentTime() || 0;
      setPlayerState(prev => ({ ...prev, currentTime }));
      if (options.onTimeUpdate) {
        options.onTimeUpdate(currentTime);
      }
    });

    player.on('ended', () => {
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
      if (options.onEnded) {
        options.onEnded();
      }
    });

    player.on('volumechange', () => {
      setPlayerState(prev => ({
        ...prev,
        volume: player.volume() || 0,
      }));
    });

    player.on('ratechange', () => {
      setPlayerState(prev => ({
        ...prev,
        playbackRate: player.playbackRate() || 1,
      }));
    });

    player.on('fullscreenchange', () => {
      setPlayerState(prev => ({
        ...prev,
        isFullscreen: player.isFullscreen() || false,
      }));
    });

    // Cleanup
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  // Control methods
  const play = useCallback(() => {
    playerRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pause();
  }, []);

  const seek = useCallback((time: number) => {
    playerRef.current?.currentTime(time);
  }, []);

  const setVolume = useCallback((volume: number) => {
    playerRef.current?.volume(volume);
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    playerRef.current?.playbackRate(rate);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (playerRef.current?.isFullscreen()) {
      playerRef.current.exitFullscreen();
    } else {
      playerRef.current?.requestFullscreen();
    }
  }, []);

  const seekFrame = useCallback((direction: 'forward' | 'backward', fps: number = 30) => {
    const frameDuration = 1 / fps;
    const currentTime = playerRef.current?.currentTime() || 0;
    const newTime = direction === 'forward'
      ? currentTime + frameDuration
      : currentTime - frameDuration;
    playerRef.current?.currentTime(Math.max(0, newTime));
  }, []);

  return {
    videoRef,
    playerRef,
    playerState,
    controls: {
      play,
      pause,
      seek,
      setVolume,
      setPlaybackRate,
      toggleFullscreen,
      seekFrame,
    },
  };
};
