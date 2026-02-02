/**
 * Avatar3DRenderer - Renders a .glb model using expo-gl + Three.js
 * Falls back to a silhouette placeholder if loading fails.
 */

import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { Asset } from 'expo-asset';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function Avatar3DRenderer({ modelAsset, isTalking, style }) {
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const animFrameRef = useRef(null);
  const sceneRef = useRef(null);
  const modelRef = useRef(null);
  const mixerRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());

  // If loading failed, show placeholder
  if (loadError) {
    return (
      <View style={[styles.container, style, styles.fallback]}>
        <Ionicons name="cube-outline" size={100} color="rgba(108,99,255,0.25)" />
        <Text style={styles.fallbackText}>Modelo 3D</Text>
      </View>
    );
  }

  const onContextCreate = async (gl) => {
    try {
      // Renderer
      const renderer = new Renderer({ gl });
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.setClearColor(0x000000, 0); // transparent background
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;

      // Scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Camera - portrait framing for full-body
      const camera = new THREE.PerspectiveCamera(
        30,
        gl.drawingBufferWidth / gl.drawingBufferHeight,
        0.1,
        100
      );
      camera.position.set(0, 0.9, 3.2);
      camera.lookAt(0, 0.8, 0);

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
      dirLight.position.set(2, 3, 4);
      scene.add(dirLight);

      const fillLight = new THREE.DirectionalLight(0x8888ff, 0.4);
      fillLight.position.set(-2, 1, -1);
      scene.add(fillLight);

      // Rim light for outline effect
      const rimLight = new THREE.DirectionalLight(0x6c63ff, 0.3);
      rimLight.position.set(0, 2, -3);
      scene.add(rimLight);

      // Load GLB model
      setLoading(true);
      try {
        const asset = Asset.fromModule(require('../../assets/models/avatar.glb'));
        await asset.downloadAsync();

        // Disable createImageBitmap so GLTFLoader falls back to ImageLoader,
        // which expo-three polyfills correctly for React Native.
        const _cib = globalThis.createImageBitmap;
        globalThis.createImageBitmap = undefined;

        const loader = new GLTFLoader();

        // Fetch the model data as ArrayBuffer
        const assetUri = asset.localUri || asset.uri;
        const response = await fetch(assetUri);
        const arrayBuffer = await response.arrayBuffer();

        // Use the asset directory as basePath so relative texture refs resolve
        const basePath = assetUri.substring(0, assetUri.lastIndexOf('/') + 1);

        let gltf;
        try {
          gltf = await new Promise((resolve, reject) => {
            loader.parse(arrayBuffer, basePath, resolve, reject);
          });
        } finally {
          // Restore createImageBitmap after parsing
          globalThis.createImageBitmap = _cib;
        }

        const model = gltf.scene;
        modelRef.current = model;

        // Auto-scale and center the model
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Scale to fit screen height (target ~2 units tall for full body)
        const targetHeight = 2.0;
        const scale = targetHeight / size.y;
        model.scale.setScalar(scale);

        // Center horizontally, place feet near bottom
        model.position.x = -center.x * scale;
        model.position.y = -box.min.y * scale - 0.2;
        model.position.z = -center.z * scale;

        scene.add(model);

        // Setup animation mixer if model has animations
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          mixerRef.current = mixer;
          const action = mixer.clipAction(gltf.animations[0]);
          action.play();
        }

        setLoading(false);
      } catch (e) {
        console.warn('GLB load error:', e);
        setLoadError(true);
        setLoading(false);
        return;
      }

      // Render loop
      const animate = () => {
        animFrameRef.current = requestAnimationFrame(animate);
        const delta = clockRef.current.getDelta();

        // Update animations
        if (mixerRef.current) {
          mixerRef.current.update(delta);
        }

        // Subtle idle sway
        if (modelRef.current) {
          modelRef.current.rotation.y = Math.sin(Date.now() * 0.0005) * 0.08;
        }

        renderer.render(scene, camera);
        gl.endFrameEXP();
      };

      animate();
    } catch (e) {
      console.warn('GL context error:', e);
      setLoadError(true);
    }
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return (
    <View style={[styles.container, style]}>
      <GLView
        style={styles.glView}
        onContextCreate={onContextCreate}
      />
      {loading && (
        <View style={styles.loadingOverlay}>
          <Ionicons name="cube-outline" size={50} color="rgba(108,99,255,0.3)" />
          <Text style={styles.loadingText}>Cargando modelo...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glView: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    color: 'rgba(108,99,255,0.3)',
    fontSize: 14,
    marginTop: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(240,240,245,0.4)',
    fontSize: 13,
    marginTop: 8,
  },
});
