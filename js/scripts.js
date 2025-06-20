// ******************************************************************************************
// credit to https://github.com/simondevyoutube for the starter code for first person camera, movement, and texture mapping.
// ******************************************************************************************

// imports
import * as THREE from "https://cdn.skypack.dev/three@0.136";

import { EffectComposer } from "https://cdn.skypack.dev/three@0.136/examples/jsm/postprocessing/EffectComposer.js";
import { ShaderPass } from "https://cdn.skypack.dev/three@0.136/examples//jsm/postprocessing/ShaderPass.js";
import { GammaCorrectionShader } from "https://cdn.skypack.dev/three@0.136/examples/jsm/shaders/GammaCorrectionShader.js";
import { RenderPass } from "https://cdn.skypack.dev/three@0.136/examples/jsm/postprocessing/RenderPass.js";
import { FXAAShader } from "https://cdn.skypack.dev/three@0.136/examples/jsm/shaders/FXAAShader.js";

import { math } from "./math.js";
import { noise } from "./noise.js";
// camera bool
let isCameraMovementEnabled = true;

// fps counter
const fpsCounterElement = document.getElementById("fpsCounter");
const clock = new THREE.Clock();

// keycodes for movement
const KEYS = {
  a: 65,
  s: 83,
  w: 87,
  d: 68,
};

// user input for movement and camera
class InputController {
  constructor(target) {
    this.target_ = target || document;
    this.initialize_();
  }

  initialize_() {
    this.current_ = {
      leftButton: false,
      rightButton: false,
      mouseXDelta: 0,
      mouseYDelta: 0,
      mouseX: 0,
      mouseY: 0,
    };
    this.previous_ = null;
    this.keys_ = {};
    this.previousKeys_ = {};
    this.target_.addEventListener(
      "mousedown",
      (e) => this.onMouseDown_(e),
      false
    );
    this.target_.addEventListener(
      "mousemove",
      (e) => this.onMouseMove_(e),
      false
    );
    this.target_.addEventListener("mouseup", (e) => this.onMouseUp_(e), false);
    this.target_.addEventListener("keydown", (e) => this.onKeyDown_(e), false);
    this.target_.addEventListener("keyup", (e) => this.onKeyUp_(e), false);
  }

  onMouseMove_(e) {
    if (isCameraMovementEnabled) {
      let movementX = e.movementX;
      let movementY = e.movementY;

      this.current_.mouseX = e.clientX;
      this.current_.mouseY = e.clientY;

      if (this.previous_ === null) {
        this.previous_ = { ...this.current_ };
      }

      this.current_.mouseXDelta = movementX;
      this.current_.mouseYDelta = movementY;
    }
  }

  onMouseDown_(e) {
    this.onMouseMove_(e);

    switch (e.button) {
      case 0: {
        this.current_.leftButton = true;
        break;
      }
      case 2: {
        this.current_.rightButton = true;
        break;
      }
    }
  }

  onMouseUp_(e) {
    this.onMouseMove_(e);

    switch (e.button) {
      case 0: {
        this.current_.leftButton = false;
        break;
      }
      case 2: {
        this.current_.rightButton = false;
        break;
      }
    }
  }

  onKeyDown_(e) {
    this.keys_[e.keyCode] = true;
  }

  onKeyUp_(e) {
    this.keys_[e.keyCode] = false;
  }

  key(keyCode) {
    return !!this.keys_[keyCode];
  }

  isReady() {
    return this.previous_ !== null;
  }

  update(_) {
    if (this.previous_ !== null) {
      this.current_.mouseXDelta = this.current_.mouseX - this.previous_.mouseX;
      this.current_.mouseYDelta = this.current_.mouseY - this.previous_.mouseY;

      this.previous_ = { ...this.current_ };
    }
  }
}

// display from first person perspective
class FirstPersonCamera {
  constructor(camera, objects) {
    this.camera_ = camera;
    this.input_ = new InputController();
    this.phi_ = Math.PI / 2; // starting angle looking 90 degrees to the left, spawns with a slight jolt in the beginning though - need to fix later
    this.phiSpeed_ = 8;
    this.theta_ = 0;
    this.thetaSpeed_ = 5;
    this.movementSpeed_ = 10;
    this.rotation_ = new THREE.Quaternion();
    this.translation_ = new THREE.Vector3(30, 2, 0);
    this.bobTimer_ = 0;
    this.bobMagnitude_ = 0.175;
    this.bobFrequency_ = 10;
    this.objects_ = objects;
  }

  update(timeElapsedS) {
    if (this.input_.isReady()) {
      this.updateRotation_(timeElapsedS);
      this.updateTranslation_(timeElapsedS);
      this.updateBob_(timeElapsedS);
      this.updateCamera_(timeElapsedS);
    }

    this.input_.update(timeElapsedS);
  }

  updateBob_(timeElapsedS) {
    if (this.bobActive_) {
      const waveLength = Math.PI;
      const nextStep =
        1 +
        Math.floor(
          ((this.bobTimer_ + 0.000001) * this.bobFrequency_) / waveLength
        );
      const nextStepTime = (nextStep * waveLength) / this.bobFrequency_;
      this.bobTimer_ = Math.min(this.bobTimer_ + timeElapsedS, nextStepTime);

      if (this.bobTimer_ == nextStepTime) {
        this.bobActive_ = false;
        this.bobTimer_ = 0;
      }
    }
  }

  updateCamera_(timeElapsedS) {
    this.camera_.quaternion.copy(this.rotation_);
    this.camera_.position.copy(this.translation_);
    this.camera_.position.y +=
      Math.sin(this.bobTimer_ * this.bobFrequency_) * this.bobMagnitude_;

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.rotation_);

    const dir = forward.clone();

    forward.multiplyScalar(100);
    forward.add(this.translation_);

    let closest = forward;
    const result = new THREE.Vector3();
    const ray = new THREE.Ray(this.translation_, dir);
    for (let i = 0; i < this.objects_.length; ++i) {
      if (ray.intersectBox(this.objects_[i], result)) {
        if (result.distanceTo(ray.origin) < closest.distanceTo(ray.origin)) {
          closest = result.clone();
        }
      }
    }

    this.camera_.lookAt(closest);
  }

  updateTranslation_(timeElapsedS) {
    const forwardVelocity =
      (this.input_.key(KEYS.w) ? 1 : 0) + (this.input_.key(KEYS.s) ? -1 : 0);
    const strafeVelocity =
      (this.input_.key(KEYS.a) ? 1 : 0) + (this.input_.key(KEYS.d) ? -1 : 0);

    const qx = new THREE.Quaternion();
    qx.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.phi_);

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(qx);
    forward.multiplyScalar(
      forwardVelocity * this.movementSpeed_ * timeElapsedS
    );

    const left = new THREE.Vector3(-1, 0, 0);
    left.applyQuaternion(qx);
    left.multiplyScalar(strafeVelocity * this.movementSpeed_ * timeElapsedS);

    this.translation_.add(forward);
    this.translation_.add(left);

    if (forwardVelocity != 0 || strafeVelocity != 0) {
      this.bobActive_ = true;
    }
  }

  updateRotation_(timeElapsedS) {
    const xh = this.input_.current_.mouseXDelta / window.innerWidth;
    const yh = this.input_.current_.mouseYDelta / window.innerHeight;

    this.phi_ += -xh * this.phiSpeed_;
    this.theta_ = math.clamp(
      this.theta_ + -yh * this.thetaSpeed_,
      -Math.PI / 3,
      Math.PI / 3
    );

    const qx = new THREE.Quaternion();
    qx.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.phi_);
    const qz = new THREE.Quaternion();
    qz.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.theta_);

    const q = new THREE.Quaternion();
    q.multiply(qx);
    q.multiply(qz);

    const t = 1.0 - Math.pow(0.001, 5 * timeElapsedS);
    this.rotation_.slerp(q, t);
  }
}

class LinearSpline {
  constructor(lerp) {
    this.points_ = [];
    this._lerp = lerp;
  }

  AddPoint(t, d) {
    this.points_.push([t, d]);
  }

  Get(t) {
    let p1 = 0;

    for (let i = 0; i < this.points_.length; i++) {
      if (this.points_[i][0] >= t) {
        break;
      }
      p1 = i;
    }

    const p2 = Math.min(this.points_.length - 1, p1 + 1);

    if (p1 == p2) {
      return this.points_[p1][1];
    }

    return this._lerp(
      (t - this.points_[p1][0]) / (this.points_[p2][0] - this.points_[p1][0]),
      this.points_[p1][1],
      this.points_[p2][1]
    );
  }
}

// main entry point
class Main {
  constructor(songName) {
    this.effects = [];
    this.songName = songName;
    this.initialize_();
    // this.createMenu_();
  }

  initialize_() {
    this.initializeRenderer_();
    this.initializeScene_();
    this.initializePostFX_();
    this.initializeAudio_(this.songName);

    this.previousRAF_ = null;
    this.raf_();
    this.onWindowResize_();
  }

  createParticleEffects() {
    // Create floating particles for magical atmosphere
    const particleCount = 100;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 5; i += 3) {
      positions[i] = (Math.random() - 0.5) * 100;     // x
      positions[i + 1] = Math.random() * 30 + 5;       // y
      positions[i + 2] = (Math.random() - 0.5) * 80;   // z
      positions[i + 3] = (Math.random() - 0.5) * 180;   // z
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.5,
      transparent: true,
      opacity: 0.6
    });
    // this.scene = new THREE.Scene();
    this.scene_.fog = new THREE.Fog(0x000033, 50, 200);
    const particleSystem = new THREE.Points(particles, particleMaterial);
    this.scene_.add(particleSystem);
    this.effects.push(particleSystem);

    // Animate particles
    const animateParticles = () => {
      if (this.effects.includes(particleSystem)) {
        const positions = particleSystem.geometry.attributes.position.array;

        for (let i = 1; i < positions.length; i += 3) {
          positions[i] += 0.02; // Move up slowly
          if (positions[i] > 35) {
            positions[i] = 5; // Reset to bottom
          }
        }

        particleSystem.geometry.attributes.position.needsUpdate = true;
        particleSystem.rotation.y += 0.002;

        requestAnimationFrame(animateParticles);
      }
    };

    animateParticles();
  }

  initializeAudio_(songName) {
    this.listener_ = new THREE.AudioListener();
    this.camera_.add(this.listener_);

    const sound1 = new THREE.PositionalAudio(this.listener_);

    this.speakerMesh1_.add(sound1);

    // audio loader and settings, spacebar to start, user can only start once
    const loader = new THREE.AudioLoader();
    loader.load(`../resources/music/sound123.mp3`, (buffer) => {
      sound1.setBuffer(buffer);
      sound1.setVolume(0.5);
      sound1.setRefDistance(100);
      sound1.play();

    });
    loader.load(`resources/music/${songName}.mp3`, (buffer) => {
      // const handleKeyDown = (event) => {
      setTimeout(() => {
        sound1.pause();

        const sound2 = new THREE.PositionalAudio(this.listener_);
        sound2.setBuffer(buffer);
        sound2.setLoop(true);
        sound2.setVolume(0.5);
        sound2.setRefDistance(100);
        sound2.play();
        this.createParticleEffects();
        // this.initializeScene_();
        this.analyzer1_ = new THREE.AudioAnalyser(sound1, 128);
        this.analyzer1Data_ = [];
      }, 160000);
      // }

      // document.addEventListener("keydown", handleKeyDown);
    });

    this.indexTimer_ = 0;
    this.noise1_ = new noise.Noise({
      octaves: 3,
      persistence: 0.5,
      lacunarity: 1.6,
      exponentiation: 1.0,
      height: 20.0,
      scale: 0.1,
      seed: 1,
    });
  }

  initializeScene_() {
    const distance = 50.0;
    const angle = Math.PI / 4.0;
    const penumbra = 0.5;
    const decay = 1.0;

    let light = null;

    // Spotlight on speaker
    light = new THREE.SpotLight(
      0xffffff,
      100.0,
      distance,
      angle,
      penumbra,
      decay
    );
    light.castShadow = true;
    light.shadow.bias = -0.00001;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 100;
    light.position.set(-35, 25, 0);
    light.target.position.set(-40, 4, 0);
    this.scene_.add(light);
    this.scene_.add(light.target);

    // Spotlight above speaker
    light = new THREE.SpotLight(
      0xffffff,
      100.0,
      distance,
      angle,
      penumbra,
      decay
    );
    light.castShadow = true;
    light.shadow.bias = -0.00001;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 100;
    light.position.set(-0, 25, 0);
    light.target.position.set(-40, 4, 0);
    this.scene_.add(light);
    this.scene_.add(light.target);

    // Hemisphere light
    const upColor = 0xffe5b4;
    const downColor = 0xc0c0c0;
    light = new THREE.HemisphereLight(upColor, downColor, 0.5);
    light.color.setHSL(0.6, 0.5, 0.2);
    light.groundColor.setHSL(0.095, 1, 0.75);
    light.position.set(0, 4, 0);
    this.scene_.add(light);

    const mapLoader = new THREE.TextureLoader();
    const maxAnisotropy = this.threejs_.capabilities.getMaxAnisotropy();

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100, 10, 10),
      this.loadMaterial_("rustediron2_", 4)
    );
    plane.castShadow = false;
    plane.receiveShadow = true;
    plane.rotation.x = -Math.PI / 2;
    this.scene_.add(plane);

    const concreteMaterial = this.loadMaterial_("concrete3-", 4);


    const wall1 = new THREE.Mesh(
      new THREE.BoxGeometry(100, 500, 4),
      concreteMaterial
    );
    wall1.position.set(0, -40, -50);
    wall1.castShadow = true;
    wall1.receiveShadow = true;
    this.scene_.add(wall1);

    const wall2 = new THREE.Mesh(
      new THREE.BoxGeometry(100, 500, 4),
      concreteMaterial
    );
    wall2.position.set(0, -40, 50);
    wall2.castShadow = true;
    wall2.receiveShadow = true;
    this.scene_.add(wall2);

    const wall3 = new THREE.Mesh(
      new THREE.BoxGeometry(4, 500, 100),
      concreteMaterial
    );
    wall3.position.set(50, -40, 0);
    wall3.castShadow = true;
    wall3.receiveShadow = true;
    this.scene_.add(wall3);

    const wall4 = new THREE.Mesh(
      new THREE.BoxGeometry(4, 500, 100),
      concreteMaterial
    );
    wall4.position.set(-50, -40, 0);
    wall4.castShadow = true;
    wall4.receiveShadow = true;
    this.scene_.add(wall4);

    const block1 = new THREE.Mesh(
      new THREE.BoxGeometry(5, 25, 8),
      this.loadMaterial_("worn_metal4_", 1)
    );
    block1.position.set(-40, 5, 35);
    block1.castShadow = true;
    block1.receiveShadow = true;
    this.scene_.add(block1);

    const block2 = new THREE.Mesh(
      new THREE.BoxGeometry(5, 25, 8),
      this.loadMaterial_("worn_metal4_", 1)
    );

    block2.position.set(-40, 5, -35);
    block2.castShadow = true;
    block2.receiveShadow = true;
    this.scene_.add(block2);

    // MAIN SPEAKER WITH LOCAL VIDEO
    // Create video element
    this.videoPaths_ = [
      '../resources/videos/countdown2.mp4',
      '../resources/videos/opendoor.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/suzume.mp4',
      '../resources/videos/dog.mp4',
    ];
    this.currentVideoIndex_ = 0;

    // Create video element
    const video = document.createElement('video');
    video.src = this.videoPaths_[this.currentVideoIndex_];
    video.crossOrigin = "anonymous";
    video.muted = true; // Muted for autoplay
    video.play().catch(e => console.error("Video play failed:", e));

    // Create video texture
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;

    // Speaker material with video texture
    const speakerMaterial = new THREE.MeshStandardMaterial({
      map: videoTexture,
      side: THREE.FrontSide
    });

    const speaker1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 40, 60),
      speakerMaterial
    );
    speaker1.position.set(-40, 20, 0);
    speaker1.castShadow = true;
    speaker1.receiveShadow = true;
    this.scene_.add(speaker1);

    setTimeout(() => {

    // Image array for slideshow
    this.imagePaths_ = [
      '../resources/freepbr/image1.jpg', 
      '../resources/freepbr/image2.jpg', 
      '../resources/freepbr/image3.jpg', 
      '../resources/freepbr/image4.jpg', 
      '../resources/freepbr/image5.jpg', 
      '../resources/freepbr/image6.jpg', 
      '../resources/freepbr/image7.jpg', 
      '../resources/freepbr/image8.jpg', 
    ];
    this.currentImageIndex2_ = 0; // For speaker2
    this.currentImageIndex3_ = 0; // For speaker3

    // Load initial image texture for speaker2
    const imageTexture2 = mapLoader.load(this.imagePaths_[this.currentImageIndex2_]);
    imageTexture2.minFilter = THREE.LinearFilter;
    imageTexture2.magFilter = THREE.LinearFilter;
    imageTexture2.anisotropy = this.threejs_.capabilities.getMaxAnisotropy();

    // Speaker material with image texture for speaker2
    const speakerMaterial2 = new THREE.MeshStandardMaterial({
      map: imageTexture2,
      side: THREE.FrontSide
    });

    // Speaker 2 (perpendicular along Z-axis, facing +X)
    const speaker2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 40, 60),
      speakerMaterial2
    );
    speaker2.position.set(0, 20, -40); // Position at Z = -40
    speaker2.rotation.y = Math.PI / 2; // Rotate 90 degrees around Y to face +X
    speaker2.castShadow = true;
    speaker2.receiveShadow = true;
    this.scene_.add(speaker2);

    // Slideshow for speaker2
    const slideshowInterval2 = setInterval(() => {
      this.currentImageIndex2_ = (this.currentImageIndex2_ + 1) % this.imagePaths_.length;
      const newTexture2 = mapLoader.load(this.imagePaths_[this.currentImageIndex2_]);
      newTexture2.minFilter = THREE.LinearFilter;
      newTexture2.magFilter = THREE.LinearFilter;
      newTexture2.anisotropy = this.threejs_.capabilities.getMaxAnisotropy();
      speakerMaterial2.map = newTexture2;
      speakerMaterial2.needsUpdate = true;
    }, 7500); // Change image every 5 seconds
  

    setTimeout(()=> {
    
    // Load initial image texture for speaker3
    const imageTexture3 = mapLoader.load(this.imagePaths_[this.currentImageIndex3_]);
    imageTexture3.minFilter = THREE.LinearFilter;
    imageTexture3.magFilter = THREE.LinearFilter;
    imageTexture3.anisotropy = this.threejs_.capabilities.getMaxAnisotropy();

    // Speaker material with image texture for speaker3
    const speakerMaterial3 = new THREE.MeshStandardMaterial({
      map: imageTexture3,
      side: THREE.FrontSide
    });

    // Speaker 3 (perpendicular along Z-axis, facing -X)
    const speaker3 = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 40, 60),
      speakerMaterial3
    );
    speaker3.position.set(0, 20, 40); // Position at Z = +40
    speaker3.rotation.y = -Math.PI / 2; // Rotate -90 degrees around Y to face -X
    speaker3.castShadow = true;
    speaker3.receiveShadow = true;
    this.scene_.add(speaker3);

    

    // Slideshow for speaker3
    const slideshowInterval3 = setInterval(() => {
      this.currentImageIndex3_ = (this.currentImageIndex3_ + 1) % this.imagePaths_.length;
      const newTexture3 = mapLoader.load(this.imagePaths_[this.currentImageIndex3_]);
      newTexture3.minFilter = THREE.LinearFilter;
      newTexture3.magFilter = THREE.LinearFilter;
      newTexture3.anisotropy = this.threejs_.capabilities.getMaxAnisotropy();
      speakerMaterial3.map = newTexture3;
      speakerMaterial3.needsUpdate = true;
    }, 9000); // Change image every 5 seconds
  },7500)
},61000);
    this.speakerMesh1_ = speaker1;
    this.videoElement_ = video; // Store video element for control

    // Event listener for video end
    this.videoElement_.addEventListener('ended', () => {
      if (this.currentVideoIndex_ < this.videoPaths_.length - 1) {
        // Move to next video
        this.currentVideoIndex_++;
        this.videoElement_.src = this.videoPaths_[this.currentVideoIndex_];
        this.videoElement_.play().catch(e => console.error("Video play failed:", e));
      } else {
        // Loop last video
        this.videoElement_.loop = true;
        this.videoElement_.play().catch(e => console.error("Video play failed:", e));
      }
    });

    // Fog
    this.scene_.fog = new THREE.FogExp2(0x000000, 0.01);
    // Background texture
    const diffuseMap = mapLoader.load("resources/background-grey-dots.png");
    diffuseMap.anisotropy = maxAnisotropy;

    // Create Box3 for collision detection
    const meshes = [plane, wall1, wall2, wall3, wall4];
    this.objects_ = [];
    for (let i = 0; i < meshes.length; ++i) {
      const b = new THREE.Box3();
      b.setFromObject(meshes[i]);
      this.objects_.push(b);
    }

    this.fpsCamera_ = new FirstPersonCamera(this.camera_, this.objects_);
  }

  loadMaterial_(name, tiling) {
    const mapLoader = new THREE.TextureLoader();
    const maxAnisotropy = this.threejs_.capabilities.getMaxAnisotropy();

    const metalMap = mapLoader.load(
      "resources/freepbr/" + name + "metallic.png"
      // "../resources/freepbr/1735923002421.jpeg"

    );
    metalMap.anisotropy = maxAnisotropy;
    metalMap.wrapS = THREE.RepeatWrapping;
    metalMap.wrapT = THREE.RepeatWrapping;
    metalMap.repeat.set(tiling, tiling);

    const albedo = mapLoader.load("resources/freepbr/" + name + "albedo.png");
    albedo.anisotropy = maxAnisotropy;
    albedo.wrapS = THREE.RepeatWrapping;
    albedo.wrapT = THREE.RepeatWrapping;
    albedo.repeat.set(tiling, tiling);

    const normalMap = mapLoader.load(
      "resources/freepbr/" + name + "normal.png"
      // "../resources/freepbr/1735923002421.jpeg"

    );
    normalMap.anisotropy = maxAnisotropy;
    normalMap.wrapS = THREE.RepeatWrapping;
    normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(tiling, tiling);

    const roughnessMap = mapLoader.load(
      "resources/freepbr/" + name + "roughness.png"
      // "../resources/freepbr/1735923002421.jpeg"
    );
    roughnessMap.anisotropy = maxAnisotropy;
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(tiling, tiling);

    const material = new THREE.MeshStandardMaterial({
      metalnessMap: metalMap,
      map: albedo,
      normalMap: normalMap,
      roughnessMap: roughnessMap,
    });

    return material;
  }

  // loadMaterial_(name, tiling) {
  //     const mapLoader = new THREE.TextureLoader();
  //     const maxAnisotropy = this.threejs_.capabilities.getMaxAnisotropy();

  //     const metalMap = mapLoader.load(
  //       "resources/freepbr/" + name + "metallic.png"
  //     );
  //     metalMap.anisotropy = maxAnisotropy;
  //     metalMap.wrapS = THREE.RepeatWrapping;
  //     metalMap.wrapT = THREE.RepeatWrapping;
  //     metalMap.repeat.set(tiling, tiling);

  //     const albedo = mapLoader.load("resources/freepbr/" + name + "albedo.png");
  //     albedo.anisotropy = maxAnisotropy;
  //     albedo.wrapS = THREE.RepeatWrapping;
  //     albedo.wrapT = THREE.RepeatWrapping;
  //     albedo.repeat.set(tiling, tiling);

  //     const normalMap = mapLoader.load(
  //       "resources/freepbr/" + name + "normal.png"
  //     );
  //     normalMap.anisotropy = maxAnisotropy;
  //     normalMap.wrapS = THREE.RepeatWrapping;
  //     normalMap.wrapT = THREE.RepeatWrapping;
  //     normalMap.repeat.set(tiling, tiling);

  //     const roughnessMap = mapLoader.load(
  //       "resources/freepbr/" + name + "roughness.png"
  //     );
  //     roughnessMap.anisotropy = maxAnisotropy;
  //     roughnessMap.wrapS = THREE.RepeatWrapping;
  //     roughnessMap.wrapT = THREE.RepeatWrapping;
  //     roughnessMap.repeat.set(tiling, tiling);

  //     const material = new THREE.MeshStandardMaterial({
  //       metalnessMap: metalMap,
  //       map: albedo,
  //       normalMap: normalMap,
  //       roughnessMap: roughnessMap,
  //     });

  //     return material;
  // }

  initializeRenderer_() {
    this.threejs_ = new THREE.WebGLRenderer({
      antialias: false,
    });
    this.threejs_.shadowMap.enabled = true;
    this.threejs_.shadowMap.type = THREE.PCFSoftShadowMap;
    this.threejs_.setPixelRatio(window.devicePixelRatio);
    this.threejs_.setSize(window.innerWidth, window.innerHeight);
    this.threejs_.physicallyCorrectLights = true;
    this.threejs_.autoClear = false;

    document.body.appendChild(this.threejs_.domElement);

    window.addEventListener(
      "resize",
      () => {
        this.onWindowResize_();
      },
      false
    );

    const fov = 60;
    const aspect = 1920 / 1080;
    const near = 1.0;
    const far = 1000.0;
    this.camera_ = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera_.position.set(-300, 2, 0);

    this.scene_ = new THREE.Scene();

    this.uiCamera_ = new THREE.OrthographicCamera(
      -1,
      1,
      1 * aspect,
      -1 * aspect,
      1,
      1000
    );
    this.uiScene_ = new THREE.Scene();
  }

  initializePostFX_() {
    const parameters = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      stencilBuffer: true,
    };

    const renderTarget = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight,
      parameters
    );

    this.composer_ = new EffectComposer(this.threejs_, renderTarget);
    this.composer_.setPixelRatio(window.devicePixelRatio);
    this.composer_.setSize(window.innerWidth, window.innerHeight);

    this.fxaaPass_ = new ShaderPass(FXAAShader);

    const uiPass = new RenderPass(this.uiScene_, this.uiCamera_);
    uiPass.clear = false;

    this.composer_.addPass(new RenderPass(this.scene_, this.camera_));
    this.composer_.addPass(uiPass);
    this.composer_.addPass(new ShaderPass(GammaCorrectionShader));
    this.composer_.addPass(this.fxaaPass_);
  }

  onWindowResize_() {
    this.camera_.aspect = window.innerWidth / window.innerHeight;
    this.camera_.updateProjectionMatrix();

    this.uiCamera_.left = -this.camera_.aspect;
    this.uiCamera_.right = this.camera_.aspect;
    this.uiCamera_.updateProjectionMatrix();

    this.threejs_.setSize(window.innerWidth, window.innerHeight);
    this.composer_.setSize(window.innerWidth, window.innerHeight);

    const pixelRatio = this.threejs_.getPixelRatio();
    this.fxaaPass_.material.uniforms["resolution"].value.x =
      1 / (window.innerWidth * pixelRatio);
    this.fxaaPass_.material.uniforms["resolution"].value.y =
      1 / (window.innerHeight * pixelRatio);
  }

  raf_() {
    requestAnimationFrame((t) => {
      if (this.previousRAF_ === null) {
        this.previousRAF_ = t;
      }

      this.step_(t - this.previousRAF_);
      this.composer_.render();

      this.previousRAF_ = t;
      this.raf_();
    });
  }

  // main loop
  step_(timeElapsed) {
    const timeElapsedS = timeElapsed * 0.001;
    this.fpsCamera_.update(timeElapsedS);

    if (this.analyzer1_) {
      this.indexTimer_ += timeElapsedS * 0.1;

      this.analyzer1Data_.push([...this.analyzer1_.getFrequencyData()]);
      // const rows = this.speakerMeshes1_.length;
      // if (this.analyzer1Data_.length > rows) {
      //   this.analyzer1Data_.shift();
      // }

      const colorSpline = new LinearSpline((t, a, b) => {
        const c = a.clone();
        return c.lerp(b, t);
      });
      colorSpline.AddPoint(0.0, new THREE.Color(0x000000)); // low frequency, black
      colorSpline.AddPoint(0.25, new THREE.Color(0xffa6a6)); // mid frequency, pastel red
      colorSpline.AddPoint(1.0, new THREE.Color(0xffffb3)); // high frequency, pastel yellow

      // remap to match speaker layout
      const remap = [];
      for (let x = -50; x <= 50; ++x) {
        for (let y = 0; y < 64; ++y) {
          remap.push((x + 50) * 64 + y);
        }
      }

      // for (let r = 0; r < this.analyzer1Data_.length; ++r) {
      //   const data = this.analyzer1Data_[r];
      //   const speakerRow = this.speakerMeshes1_[r];
      //   for (let i = 0; i < data.length; ++i) {
      //     const freqScale = math.smootherstep(
      //       (data[remap[i]] / 255) ** 0.5,
      //       0,
      //       1
      //     );
      //     const sc =
      //       1 +
      //       6 * freqScale +
      //       this.noise1_.Get(this.indexTimer_, r * 0.42142, i * 0.3455);
      //     speakerRow[i].scale.set(sc, 1, 1);
      //     speakerRow[i].material.color.copy(colorSpline.Get(freqScale));
      //     speakerRow[i].material.emissive.copy(colorSpline.Get(freqScale));
      //     speakerRow[i].material.emissive.multiplyScalar(freqScale ** 2);
      //   }
      // }

      // spotlight color that changes based on average frequency
      let spotlight1 = this.scene_.children[0];
      let spotlight2 = this.scene_.children[2];
      let totalFrequency = 0;
      let numFrequencies = 0;

      for (let r = 0; r < this.analyzer1Data_.length; ++r) {
        const data = this.analyzer1Data_[r];
        for (let i = 0; i < data.length; ++i) {
          totalFrequency += data[remap[i]];
          numFrequencies++;
        }
      }

      const averageFrequency = totalFrequency / numFrequencies;

      const minFrequency = 0;
      const maxFrequency = 255;
      const minHue = 0;
      const maxHue = 360;

      const mappedHue =
        ((averageFrequency - minFrequency) * (maxHue - minHue)) /
        (maxFrequency - minFrequency) +
        minHue;

      let h = mappedHue;
      const s = 0.5;
      const l = 0.5;

      const color = new THREE.Color();
      color.setHSL(h, s, l);

      spotlight1.color = color;
      spotlight2.color = color;

      // fps counter
      const delta = clock.getDelta();
      const fps = 1 / delta;

      // display fps counter
      fpsCounterElement.textContent = "FPS: " + Math.round(fps);
    }
  }
}

let _APP = null;

// [had to use some local storage wizardry to get the song to change properly without bizzare audio bugs]
// store the returned variable in localStorage
function storeReturnedVariable(value) {
  localStorage.setItem("returnedVariable", JSON.stringify(value));
  console.log(localStorage);
}

// retrieve the stored variable from localStorage
function getStoredReturnedVariable() {
  const storedValue = localStorage.getItem("returnedVariable");
  return storedValue ? JSON.parse(storedValue) : null;
}

// helper function to change the song and reload the document
function changeSong(songName) {
  // store the returned variable
  storeReturnedVariable(songName);

  // reload the document
  location.reload();
}


// to circumvent autoplay policy
window.addEventListener("DOMContentLoaded", () => {
  // retrieve the stored returned variable after document reload
  const storedReturnedVariable = getStoredReturnedVariable();
  // grab tutorial message, fpscounter, epilepsyWarning elements
  const tutorialMessage = document.getElementById("tutorialMessage");
  const fpsCounter = document.getElementById("fpsCounter");
  // const epilepsyWarning = document.getElementById("epilepsyWarning");

  const _Setup = () => {
    _APP = new Main(storedReturnedVariable || "sparkle"); // use the stored returned variable if it exists, otherwise use the default song
    document.body.removeEventListener("click", _Setup);
    tutorialMessage.style.display = "none"; // hide the tutorial message
    // epilepsyWarning.style.display = "none"; // hide the epilepsyWarning
    fpsCounter.style.display = "block"; // show the fpsCounter
  };
  document.body.addEventListener("click", _Setup);

  // lock mouse pointer on click
  document.body.addEventListener("click", () => {
    _APP.threejs_.domElement.requestPointerLock();
  });
});
