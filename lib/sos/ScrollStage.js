import * as THREE from 'three'
import GSAP from 'gsap'

import SmoothScroll from './SmoothScroll'

import vertexShader from '../../shaders/vertex.glsl'
import fragmentShader from '../../shaders/fragment.glsl'

export default class ScrollStage {
  constructor() {
    this.element = document.querySelector('.content')

    this.elements = {
      line: this.element.querySelector('.layout__line')
    }

    this.viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    }

    this.mouse = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      ease: 0.1
    }

    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()

    this.isMouseDown = false
    this.rotationSpeed = 0.2

    this.scroll = {
      height: 0,
      limit: 0,
      hard: 0,
      soft: 0,
      ease: 0.05,
      normalized: 0,
      running: false
    }

    this.settings = {
      // vertex
      uFrequency: {
        start: 4,
        end: 0
      },
      uAmplitude: {
        start: 4,
        end: 4
      },
      uDensity: {
        start: 1,
        end: 1
      },
      uStrength: {
        start: 1.1,
        end: 0
      },
      // fragment
      uDeepPurple: {  // max 1
        start: 0,
        end: 1
      },
      uOpacity: {  // max 1
        start: .66,
        end: .1
      }
    }

    this.scene = new THREE.Scene()

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    })

    this.canvas = this.renderer.domElement

    this.camera = new THREE.PerspectiveCamera(
      75,
      this.viewport.width / this.viewport.height,
      .1,
      10
    )

    this.clock = new THREE.Clock()

    this.smoothScroll = new SmoothScroll({
      element: this.element,
      viewport: this.viewport,
      scroll: this.scroll
    })

    GSAP.defaults({
      ease: 'power2',
      duration: 6.6,
      overwrite: true
    })
    
    this.updateScrollAnimations = this.updateScrollAnimations.bind(this)
    this.update = this.update.bind(this)
        
    this.init()
  }
  
  init() {
    this.addCanvas()
    this.addCamera()
    this.addMesh()
    this.addEventListeners()
    this.onResize()
    this.update()
  }

  /**
   * STAGE
   */
  addCanvas() {
    this.canvas.classList.add('webgl')
    this.element.querySelector('.scroll__stage').prepend(this.canvas)
  }

  addCamera() {
    this.camera.position.set(0, 0, 2.5)
    this.scene.add(this.camera)
  }

  /**
   * OBJECT
   */
  addMesh() {
    this.geometry = new THREE.IcosahedronGeometry(1, 64)
    
    this.material = new THREE.ShaderMaterial({
      wireframe: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      vertexShader,
      fragmentShader,
      uniforms: {
        uFrequency: { value: this.settings.uFrequency.start },
        uAmplitude: { value: this.settings.uAmplitude.start },
        uDensity: { value: this.settings.uDensity.start },
        uStrength: { value: this.settings.uStrength.start },
        uDeepPurple: { value: this.settings.uDeepPurple.start },
        uOpacity: { value: this.settings.uOpacity.start },
        uMasterOpacity: { value: 0 },
        uMouseX: { value: 0 },
        uMouseY: { value: 0 },
        uClickPosition: { value: new THREE.Vector3() },
        uClickStrength: { value: 0 }
      }
    })
    
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    
    this.scene.add(this.mesh)
  }

  /**
   * SCROLL BASED ANIMATIONS
   */
  updateScrollAnimations() {
    this.scroll.running = false
    this.scroll.normalized = (this.scroll.hard / this.scroll.limit).toFixed(1)
    
    GSAP.to(this.mesh.rotation, {
      x: this.scroll.normalized * Math.PI
    })
 
    GSAP.to(this.elements.line, {
      scaleX: this.scroll.normalized,
      transformOrigin: 'left',
      duration: 1.5,
      ease: 'ease'
    })

    for (const key in this.settings) {
      if (this.settings[key].start !== this.settings[key].end) {
        GSAP.to(this.mesh.material.uniforms[key], {
          value: this.settings[key].start + this.scroll.normalized * (this.settings[key].end - this.settings[key].start)
        })
      }
    }
  }

  /**
   * EVENTS
   */
  addEventListeners() {
    if (document.readyState === 'complete') {
      this.onLoad()
    } else {
      window.addEventListener('load', this.onLoad.bind(this))
    }
    
    window.addEventListener('mousemove', this.onMouseMove.bind(this))
    
    window.addEventListener('mousedown', this.onMouseDown.bind(this))
    window.addEventListener('mouseup', this.onMouseUp.bind(this))

    window.addEventListener('scroll', this.onScroll.bind(this))

    window.addEventListener('resize', this.onResize.bind(this))
  }

  onLoad() {
    document.body.classList.remove('loading')
    GSAP.to(this.mesh.material.uniforms.uMasterOpacity, {
      value: 1,
      duration: 3,
      ease: 'power2.out'
    });
  }

  onMouseMove(event) {
    this.mouse.targetX = (event.clientX / this.viewport.width) - 0.5
    this.mouse.targetY = (event.clientY / this.viewport.height) - 0.5
  }

  onMouseDown(event) {
    this.isMouseDown = true;
    // Calculate pointer position in normalized device coordinates
    // (-1 to +1) for both components
    this.pointer.x = (event.clientX / this.viewport.width) * 2 - 1;
    this.pointer.y = -(event.clientY / this.viewport.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    const intersects = this.raycaster.intersectObject(this.mesh);

    if (intersects.length > 0) {
      const intersect = intersects[0];
      
      // Kill any existing animation
      GSAP.killTweensOf(this.mesh.material.uniforms.uClickStrength);

      // Update the click position uniform with the intersection point
      this.mesh.material.uniforms.uClickPosition.value.copy(intersect.point);

      // Set the strength of the click effect to full
      this.mesh.material.uniforms.uClickStrength.value = 1;
    }
  }

  onMouseUp(event) {
    this.isMouseDown = false;

    // Animate the strength of the click effect back to 0
    GSAP.to(this.mesh.material.uniforms.uClickStrength, {
      value: 0,
      duration: 1.2,
      ease: 'power2.out',
    });
  }

  onScroll() {
    if (!this.scroll.running) {
      window.requestAnimationFrame(this.updateScrollAnimations)
      
      this.scroll.running = true
    }
  }

  onResize() {
    this.viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    }

    this.smoothScroll.onResize()

    if (this.viewport.width < this.viewport.height) {
      this.mesh.scale.set(.75, .75, .75)
    } else {
      this.mesh.scale.set(1, 1, 1)
    }

    this.camera.aspect = this.viewport.width / this.viewport.height
    this.camera.updateProjectionMatrix()
    
    this.renderer.setSize(this.viewport.width, this.viewport.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  }

  /**
   * LOOP
   */
  update() {
    const deltaTime = this.clock.getDelta();

    // Handle rotation based on mouse state
    const targetRotationSpeed = this.isMouseDown ? 20.0 : 0.2;
    this.rotationSpeed = GSAP.utils.interpolate(this.rotationSpeed, targetRotationSpeed, 0.1);
    this.mesh.rotation.y += this.rotationSpeed * deltaTime;

    this.smoothScroll.update()

    this.mouse.x = GSAP.utils.interpolate(this.mouse.x, this.mouse.targetX, this.mouse.ease)
    this.mouse.y = GSAP.utils.interpolate(this.mouse.y, this.mouse.targetY, this.mouse.ease)

    this.mesh.material.uniforms.uMouseX.value = this.mouse.x
    this.mesh.material.uniforms.uMouseY.value = this.mouse.y

    this.render()

    window.requestAnimationFrame(this.update)
  }

  /**
   * RENDER
   */
  render() {
    this.renderer.render(this.scene, this.camera)
  }
}