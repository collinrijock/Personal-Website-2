import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';

// Vertex Shader (extracted from 'C' in the provided compiled JS)
const VERTEX_SHADER = `
precision highp float;

/*
original_author: [Ian McEwan, Ashima Arts]
description: modulus of 289
use: mod289(<float|vec2|vec3|vec4> x)
*/

#ifndef FNC_MOD289
#define FNC_MOD289

float mod289(const in float x) { return x - floor(x * (1. / 289.)) * 289.; }
vec2 mod289(const in vec2 x) { return x - floor(x * (1. / 289.)) * 289.; }
vec3 mod289(const in vec3 x) { return x - floor(x * (1. / 289.)) * 289.; }
vec4 mod289(const in vec4 x) { return x - floor(x * (1. / 289.)) * 289.; }

#endif


/*
original_author: [Ian McEwan, Ashima Arts]
description: permute
use: permute(<float|vec2|vec3|vec4> x)
*/

#ifndef FNC_PERMUTE
#define FNC_PERMUTE

float permute(const in float x) { return mod289(((x * 34.0) + 1.0) * x); }
vec2 permute(const in vec2 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec3 permute(const in vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 permute(const in vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }

#endif


// Authors: Stefan Gustavson (stefan.gustavson@gmail.com)
// and Ian McEwan (ijm567@gmail.com)
// Version 2021-12-02, published under the MIT license (see below)
//
// Copyright (c) 2021 Stefan Gustavson and Ian McEwan.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the "Software"),
// to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense,
// and/or sell copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
// THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.

// Periodic (tiling) 2-D simplex noise (hexagonal lattice gradient noise)
// with rotating gradients and analytic derivatives.
//
// This is (yet) another variation on simplex noise. Unlike previous
// implementations, the grid is axis-aligned and slightly stretched in
// the y direction to permit rectangular tiling.
// The noise pattern can be made to tile seamlessly to any integer period
// in x and any even integer period in y. Odd periods may be specified
// for y, but then the actual tiling period will be twice that number.
//
// The rotating gradients give the appearance of a swirling motion, and
// can serve a similar purpose for animation as motion along z in 3-D
// noise. The rotating gradients in conjunction with the analytic
// derivatives allow for "flow noise" effects as presented by Ken
// Perlin and Fabrice Neyret.

// 2-D tiling simplex noise with rotating gradients and analytical derivative.
// "vec2 x" is the point (x,y) to evaluate,
// "vec2 period" is the desired periods along x and y, and
// "float alpha" is the rotation (in radians) for the swirling gradients.
// The "float" return value is the noise value, and
// the "out vec2 gradient" argument returns the x,y partial derivatives.
//
// Setting either period to 0.0 or a negative value will skip the wrapping
// along that dimension. Setting both periods to 0.0 makes the function
// execute about 15% faster.
//
// Not using the return value for the gradient will make the compiler
// eliminate the code for computing it. This speeds up the function
// by 10-15%.
//
// The rotation by alpha uses one single addition. Unlike the 3-D version
// of psrdnoise(), setting alpha == 0.0 gives no speedup.

float psrdnoise(vec2 x, vec2 period, float alpha, out vec2 gradient) {

	// Transform to simplex space (axis-aligned hexagonal grid)
	vec2 uv = vec2(x.x + x.y * 0.5, x.y);

	// Determine which simplex we're in, with i0 being the "base"
	vec2 i0 = floor(uv);
	vec2 f0 = fract(uv);
	// o1 is the offset in simplex space to the second corner
	float cmp = step(f0.y, f0.x);
	vec2 o1 = vec2(cmp, 1.0 - cmp);

	// Enumerate the remaining simplex corners
	vec2 i1 = i0 + o1;
	vec2 i2 = i0 + vec2(1.0, 1.0);

	// Transform corners back to texture space
	vec2 v0 = vec2(i0.x - i0.y * 0.5, i0.y);
	vec2 v1 = vec2(v0.x + o1.x - o1.y * 0.5, v0.y + o1.y);
	vec2 v2 = vec2(v0.x + 0.5, v0.y + 1.0);

	// Compute vectors from v to each of the simplex corners
	vec2 x0 = x - v0;
	vec2 x1 = x - v1;
	vec2 x2 = x - v2;

	vec3 iu, iv;
	vec3 xw, yw;

	// Wrap to periods, if desired
	if(any(greaterThan(period, vec2(0.0)))) {
	xw = vec3(v0.x, v1.x, v2.x);
	yw = vec3(v0.y, v1.y, v2.y);
	if(period.x > 0.0)
		xw = mod(vec3(v0.x, v1.x, v2.x), period.x);
	if(period.y > 0.0)
		yw = mod(vec3(v0.y, v1.y, v2.y), period.y);
		// Transform back to simplex space and fix rounding errors
	iu = floor(xw + 0.5 * yw + 0.5);
	iv = floor(yw + 0.5);
	} else { // Shortcut if neither x nor y periods are specified
	iu = vec3(i0.x, i1.x, i2.x);
	iv = vec3(i0.y, i1.y, i2.y);
	}

	// Compute one pseudo-random hash value for each corner
	vec3 hash = mod(iu, 289.0);
	hash = mod((hash * 51.0 + 2.0) * hash + iv, 289.0);
	hash = mod((hash * 34.0 + 10.0) * hash, 289.0);

	// Pick a pseudo-random angle and add the desired rotation
	vec3 psi = hash * 0.07482 + alpha;
	vec3 gx = cos(psi);
	vec3 gy = sin(psi);

	// Reorganize for dot products below
	vec2 g0 = vec2(gx.x, gy.x);
	vec2 g1 = vec2(gx.y, gy.y);
	vec2 g2 = vec2(gx.z, gy.z);

	// Radial decay with distance from each simplex corner
	vec3 w = 0.8 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2));
	w = max(w, 0.0);
	vec3 w2 = w * w;
	vec3 w4 = w2 * w2;

	// The value of the linear ramp from each of the corners
	vec3 gdotx = vec3(dot(g0, x0), dot(g1, x1), dot(g2, x2));

	// Multiply by the radial decay and sum up the noise value
	float n = dot(w4, gdotx);

	// Compute the first order partial derivatives
	vec3 w3 = w2 * w;
	vec3 dw = -8.0 * w3 * gdotx;
	vec2 dn0 = w4.x * g0 + dw.x * x0;
	vec2 dn1 = w4.y * g1 + dw.y * x1;
	vec2 dn2 = w4.z * g2 + dw.z * x2;
	gradient = 10.9 * (dn0 + dn1 + dn2);

	// Scale the return value to fit nicely into the range [-1,1]
	return 10.9 * n;
}

// 3-D tiling simplex noise with rotating gradients and first order
// analytical derivatives.
// "vec3 x" is the point (x,y,z) to evaluate
// "vec3 period" is the desired periods along x,y,z, up to 289.
// (If Perlin's grid is used, multiples of 3 up to 288 are allowed.)
// "float alpha" is the rotation (in radians) for the swirling gradients.
// The "float" return value is the noise value, and
// the "out vec3 gradient" argument returns the x,y,z partial derivatives.
//
// The function executes 15-20% faster if alpha is constant == 0.0
// across all fragments being executed in parallel.
// (This speedup will not happen if FASTROTATION is enabled. Do not specify
// FASTROTATION if you are not actually going to use the rotation.)
//
// Setting any period to 0.0 or a negative value will skip the periodic
// wrap for that dimension. Setting all periods to 0.0 makes the function
// execute 10-15% faster.
//
// Not using the return value for the gradient will make the compiler
// eliminate the code for computing it. This speeds up the function by
// around 10%.
//
float psrdnoise(vec3 x, vec3 period, float alpha, out vec3 gradient) {
#ifndef PERLINGRID
	// Transformation matrices for the axis-aligned simplex grid
	const mat3 M = mat3(0.0, 1.0, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 0.0);

	const mat3 Mi = mat3(-0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5);
#endif

	vec3 uvw;

	// Transform to simplex space (tetrahedral grid)
#ifndef PERLINGRID
	// Use matrix multiplication, let the compiler optimise
	uvw = M * x;
#else
	// Optimised transformation to uvw (slightly faster than
	// the equivalent matrix multiplication on most platforms)
	uvw = x + dot(x, vec3(1.0 / 3.0));
#endif

	// Determine which simplex we're in, i0 is the "base corner"
	vec3 i0 = floor(uvw);
	vec3 f0 = fract(uvw); // coords within "skewed cube"

	// To determine which simplex corners are closest, rank order the
	// magnitudes of u,v,w, resolving ties in priority order u,v,w,
	// and traverse the four corners from largest to smallest magnitude.
	// o1, o2 are offsets in simplex space to the 2nd and 3rd corners.
	vec3 g_ = step(f0.xyx, f0.yzz); // Makes comparison "less-than"
	vec3 l_ = 1.0 - g_;             // complement is "greater-or-equal"
	vec3 g = vec3(l_.z, g_.xy);
	vec3 l = vec3(l_.xy, g_.z);
	vec3 o1 = min(g, l);
	vec3 o2 = max(g, l);

	// Enumerate the remaining simplex corners
	vec3 i1 = i0 + o1;
	vec3 i2 = i0 + o2;
	vec3 i3 = i0 + vec3(1.0);

	vec3 v0, v1, v2, v3;

	// Transform the corners back to texture space
#ifndef PERLINGRID
	v0 = Mi * i0;
	v1 = Mi * i1;
	v2 = Mi * i2;
	v3 = Mi * i3;
#else
	// Optimised transformation (mostly slightly faster than a matrix)
	v0 = i0 - dot(i0, vec3(1.0 / 6.0));
	v1 = i1 - dot(i1, vec3(1.0 / 6.0));
	v2 = i2 - dot(i2, vec3(1.0 / 6.0));
	v3 = i3 - dot(i3, vec3(1.0 / 6.0));
#endif

	// Compute vectors to each of the simplex corners
	vec3 x0 = x - v0;
	vec3 x1 = x - v1;
	vec3 x2 = x - v2;
	vec3 x3 = x - v3;

	if(any(greaterThan(period, vec3(0.0)))) {
	// Wrap to periods and transform back to simplex space
	vec4 vx = vec4(v0.x, v1.x, v2.x, v3.x);
	vec4 vy = vec4(v0.y, v1.y, v2.y, v3.y);
	vec4 vz = vec4(v0.z, v1.z, v2.z, v3.z);
	// Wrap to periods where specified
	if(period.x > 0.0)
		vx = mod(vx, period.x);
	if(period.y > 0.0)
		vy = mod(vy, period.y);
	if(period.z > 0.0)
		vz = mod(vz, period.z);
	// Transform back
#ifndef PERLINGRID
	i0 = M * vec3(vx.x, vy.x, vz.x);
	i1 = M * vec3(vx.y, vy.y, vz.y);
	i2 = M * vec3(vx.z, vy.z, vz.z);
	i3 = M * vec3(vx.w, vy.w, vz.w);
#else
	v0 = vec3(vx.x, vy.x, vz.x);
	v1 = vec3(vx.y, vy.y, vz.y);
	v2 = vec3(vx.z, vy.z, vz.z);
	v3 = vec3(vx.w, vy.w, vz.w);
	// Transform wrapped coordinates back to uvw
	i0 = v0 + dot(v0, vec3(1.0 / 3.0));
	i1 = v1 + dot(v1, vec3(1.0 / 3.0));
	i2 = v2 + dot(v2, vec3(1.0 / 3.0));
	i3 = v3 + dot(v3, vec3(1.0 / 3.0));
#endif
	// Fix rounding errors
	i0 = floor(i0 + 0.5);
	i1 = floor(i1 + 0.5);
	i2 = floor(i2 + 0.5);
	i3 = floor(i3 + 0.5);
	}

	// Compute one pseudo-random hash value for each corner
	vec4 hash = permute(permute(permute(vec4(i0.z, i1.z, i2.z, i3.z)) + vec4(i0.y, i1.y, i2.y, i3.y)) + vec4(i0.x, i1.x, i2.x, i3.x));

	// Compute generating gradients from a Fibonacci spiral on the unit sphere
	vec4 theta = hash * 3.883222077;  // 2*pi/golden ratio
	vec4 sz = hash * -0.006920415 + 0.996539792; // 1-(hash+0.5)*2/289
	vec4 psi = hash * 0.108705628; // 10*pi/289, chosen to avoid correlation

	vec4 Ct = cos(theta);
	vec4 St = sin(theta);
	vec4 sz_prime = sqrt(1.0 - sz * sz); // s is a point on a unit fib-sphere

	vec4 gx, gy, gz;

	// Rotate gradients by angle alpha around a pseudo-random ortogonal axis
#ifdef FASTROTATION
	// Fast algorithm, but without dynamic shortcut for alpha = 0
	vec4 qx = St;         // q' = norm ( cross(s, n) )  on the equator
	vec4 qy = -Ct;
	vec4 qz = vec4(0.0);

	vec4 px = sz * qy;   // p' = cross(q, s)
	vec4 py = -sz * qx;
	vec4 pz = sz_prime;

	psi += alpha;         // psi and alpha in the same plane
	vec4 Sa = sin(psi);
	vec4 Ca = cos(psi);

	gx = Ca * px + Sa * qx;
	gy = Ca * py + Sa * qy;
	gz = Ca * pz + Sa * qz;
#else
	// Slightly slower algorithm, but with g = s for alpha = 0, and a
	// useful conditional speedup for alpha = 0 across all fragments
	if(alpha != 0.0) {
	vec4 Sp = sin(psi);          // q' from psi on equator
	vec4 Cp = cos(psi);

	vec4 px = Ct * sz_prime;     // px = sx
	vec4 py = St * sz_prime;     // py = sy
	vec4 pz = sz;

	vec4 Ctp = St * Sp - Ct * Cp;    // q = (rotate( cross(s,n), dot(s,n))(q')
	vec4 qx = mix(Ctp * St, Sp, sz);
	vec4 qy = mix(-Ctp * Ct, Cp, sz);
	vec4 qz = -(py * Cp + px * Sp);

	vec4 Sa = vec4(sin(alpha));       // psi and alpha in different planes
	vec4 Ca = vec4(cos(alpha));

	gx = Ca * px + Sa * qx;
	gy = Ca * py + Sa * qy;
	gz = Ca * pz + Sa * qz;
	} else {
	gx = Ct * sz_prime;  // alpha = 0, use s directly as gradient
	gy = St * sz_prime;
	gz = sz;
	}
#endif

	// Reorganize for dot products below
	vec3 g0 = vec3(gx.x, gy.x, gz.x);
	vec3 g1 = vec3(gx.y, gy.y, gz.y);
	vec3 g2 = vec3(gx.z, gy.z, gz.z);
	vec3 g3 = vec3(gx.w, gy.w, gz.w);

	// Radial decay with distance from each simplex corner
	vec4 w = 0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3));
	w = max(w, 0.0);
	vec4 w2 = w * w;
	vec4 w3 = w2 * w;

	// The value of the linear ramp from each of the corners
	vec4 gdotx = vec4(dot(g0, x0), dot(g1, x1), dot(g2, x2), dot(g3, x3));

	// Multiply by the radial decay and sum up the noise value
	float n = dot(w3, gdotx);

	// Compute the first order partial derivatives
	vec4 dw = -6.0 * w2 * gdotx;
	vec3 dn0 = w3.x * g0 + dw.x * x0;
	vec3 dn1 = w3.y * g1 + dw.y * x1;
	vec3 dn2 = w3.z * g2 + dw.z * x2;
	vec3 dn3 = w3.w * g3 + dw.w * x3;
	gradient = 39.5 * (dn0 + dn1 + dn2 + dn3);

	// Scale the return value to fit nicely into the range [-1,1]
	return 39.5 * n;
}


attribute vec4 tangent;

uniform float u_time;
uniform vec2 u_noise_scale;
uniform float u_noise_amp;
uniform float u_noise_speed;
uniform float u_offset;
uniform vec3 u_incline;
uniform float u_noise_translate_speed;

varying vec3 v_normal;
varying vec3 v_position;
varying vec2 v_reflected_normal;

vec3 displace(vec3 pos) {
	vec3 g;
	float d = psrdnoise(vec3(
	pos.x * u_noise_scale.x + u_noise_translate_speed * u_time,
	pos.z * u_noise_scale.y,
	u_time * u_noise_speed
	), vec3(10.0), 0.0, g);

	return vec3(
	pos.x,
	pos.y + d * u_noise_amp + pos.x * u_incline.x,
	pos.z
	);
}

void main(void) {
	// Displace surface
	vec3 biTangent = cross(tangent.xyz, normal.xyz);
	vec3 displaced = displace(position.xyz);
	vec3 displacedTangent = displace(position.xyz - tangent.xyz * u_offset);
	vec3 displacedBiTangent = displace(position.xyz - biTangent * u_offset);

	v_normal = cross(
	normalize(displacedBiTangent - displaced),
	normalize(displacedTangent - displaced)
	);

	v_position = displaced;

	vec4 p = vec4(displaced, 1.0);
	vec3 e = normalize(vec3(modelViewMatrix * p));
	vec3 n = normalize(normalMatrix * v_normal);

	vec3 r = reflect(e, n);
	float m = 2. * sqrt(
	pow(r.x, 2.0) +
	pow(r.y, 2.0) +
	pow(r.z + 1.0, 2.0)
	);
	v_reflected_normal = r.xy / m + .5;

	gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

// Main Fragment Shader (extracted from 'S' in the provided compiled JS)
const FRAGMENT_SHADER = `
precision highp float;

varying vec3 v_normal;
varying vec2 v_reflected_normal;

uniform float u_edge_reflection_max;
uniform float u_edge_reflection_min;
uniform sampler2D u_env_texture;

void main() {
	vec4 base = texture2D(
	u_env_texture,
	v_reflected_normal
	);

	base = mix(
	base,
	vec4(1.0),
	mix(
		u_edge_reflection_min,
		u_edge_reflection_max,
		abs(
		pow(
			dot(v_normal, vec3(0.0, 1.0, 0.0)),
			10.0
		)
		)
	)
	);
	gl_FragColor = base;
}
`;

// Gradient Fragment Shader (extracted from 'A' in the provided compiled JS)
const GRADIENT_FRAGMENT_SHADER = `
precision highp float;

/*
original_author: [Ian McEwan, Ashima Arts]
description: modulus of 289
use: mod289(<float|vec2|vec3|vec4> x)
*/

#ifndef FNC_MOD289
#define FNC_MOD289

float mod289(const in float x) { return x - floor(x * (1. / 289.)) * 289.; }
vec2 mod289(const in vec2 x) { return x - floor(x * (1. / 289.)) * 289.; }
vec3 mod289(const in vec3 x) { return x - floor(x * (1. / 289.)) * 289.; }
vec4 mod289(const in vec4 x) { return x - floor(x * (1. / 289.)) * 289.; }

#endif

/*
original_author: [Ian McEwan, Ashima Arts]
description: modulus of 289
use: mod289(<float|vec2|vec3|vec4> x)
*/

#ifndef FNC_MOD289
#define FNC_MOD289

float mod289(const in float x) { return x - floor(x * (1. / 289.)) * 289.; }
vec2 mod289(const in vec2 x) { return x - floor(x * (1. / 289.)) * 289.; }
vec3 mod289(const in vec3 x) { return x - floor(x * (1. / 289.)) * 289.; }
vec4 mod289(const in vec4 x) { return x - floor(x * (1. / 289.)) * 289.; }

#endif


/*
original_author: [Ian McEwan, Ashima Arts]
description: permute
use: permute(<float|vec2|vec3|vec4> x)
*/

#ifndef FNC_PERMUTE
#define FNC_PERMUTE

float permute(const in float x) { return mod289(((x * 34.0) + 1.0) * x); }
vec2 permute(const in vec2 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec3 permute(const in vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 permute(const in vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }

#endif

/*
original_author: [Ian McEwan, Ashima Arts]
description: grad4, used for snoise(vec4 v)
use: grad4(<float> j, <vec4> ip)
*/

#ifndef FNC_GRAD4
#define FNC_GRAD4
vec4 grad4(float j, vec4 ip) {
	const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
	vec4 p,s;

	p.xyz = floor( fract (vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
	p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
	s = vec4(lessThan(p, vec4(0.0)));
	p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www;

	return p;
}
#endif

/*
original_author: [Ian McEwan, Ashima Arts]
description:
use: taylorInvSqrt(<float|vec4> x)
*/

#ifndef FNC_TAYLORINVSQRT
#define FNC_TAYLORINVSQRT

float taylorInvSqrt(in float r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 taylorInvSqrt(in vec2 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec3 taylorInvSqrt(in vec3 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec4 taylorInvSqrt(in vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

#endif


/*
original_author: [Ian McEwan, Ashima Arts]
description: Simplex Noise https://github.com/ashima/webgl-noise
use: snoise(<vec2|vec3|vec4> pos)
license: |
	Copyright (C) 2011 Ashima Arts. All rights reserved.
	Copyright (C) 2011-2016 by Stefan Gustavson (Classic noise and others)
	Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
	Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
	Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
	Neither the name of the GPUImage framework nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

#ifndef FNC_SNOISE
#define FNC_SNOISE
float snoise(in vec2 v) {
	const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
						0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
						-0.577350269189626,  // -1.0 + 2.0 * C.x
						0.024390243902439); // 1.0 / 41.0
	// First corner
	vec2 i  = floor(v + dot(v, C.yy) );
	vec2 x0 = v -   i + dot(i, C.xx);

	// Other corners
	vec2 i1;
	//i1.x = step( x0.y, x0.x ); // x0.x > x0.y ? 1.0 : 0.0
	//i1.y = 1.0 - i1.x;
	i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
	// x0 = x0 - 0.0 + 0.0 * C.xx ;
	// x1 = x0 - i1 + 1.0 * C.xx ;
	// x2 = x0 - 1.0 + 2.0 * C.xx ;
	vec4 x12 = x0.xyxy + C.xxzz;
	x12.xy -= i1;

	// Permutations
	i = mod289(i); // Avoid truncation effects in permutation
	vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
	+ i.x + vec3(0.0, i1.x, 1.0 ));

	vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
	m = m*m ;
	m = m*m ;

	// Gradients: 41 points uniformly over a line, mapped onto a diamond.
	// The ring size 17*17 = 289 is close to a multiple of 41 (41*7 = 287)

	vec3 x = 2.0 * fract(p * C.www) - 1.0;
	vec3 h = abs(x) - 0.5;
	vec3 ox = floor(x + 0.5);
	vec3 a0 = x - ox;

	// Normalise gradients implicitly by scaling m
	// Approximation of: m *= inversesqrt( a0*a0 + h*h );
	m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );

	// Compute final noise value at P
	vec3 g;
	g.x  = a0.x  * x0.x  + h.x  * x0.y;
	g.yz = a0.yz * x12.xz + h.yz * x12.yw;
	return 130.0 * dot(m, g);
}


float snoise(in vec3 v) {
	const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
	const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

	// First corner
	vec3 i  = floor(v + dot(v, C.yyy) );
	vec3 x0 =   v - i + dot(i, C.xxx) ;

	// Other corners
	vec3 g = step(x0.yzx, x0.xyz);
	vec3 l = 1.0 - g;
	vec3 i1 = min( g.xyz, l.zxy );
	vec3 i2 = max( g.xyz, l.zxy );

	//   x0 = x0 - 0.0 + 0.0 * C.xxx;
	//   x1 = x0 - i1  + 1.0 * C.xxx;
	//   x2 = x0 - i2  + 2.0 * C.xxx;
	//   x3 = x0 - 1.0 + 3.0 * C.xxx;
	vec3 x1 = x0 - i1 + C.xxx;
	vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
	vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

	// Permutations
	i = mod289(i);
	vec4 p = permute( permute( permute(
				i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
			+ i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
			+ i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

	// Gradients: 7x7 points over a square, mapped onto an octahedron.
	// The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
	float n_ = 0.142857142857; // 1.0/7.0
	vec3  ns = n_ * D.wyz - D.xzx;

	vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

	vec4 x_ = floor(j * ns.z);
	vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

	vec4 x = x_ *ns.x + ns.yyyy;
	vec4 y = y_ *ns.x + ns.yyyy;
	vec4 h = 1.0 - abs(x) - abs(y);

	vec4 b0 = vec4( x.xy, y.xy );
	vec4 b1 = vec4( x.zw, y.zw );

	//vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
	//vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
	vec4 s0 = floor(b0)*2.0 + 1.0;
	vec4 s1 = floor(b1)*2.0 + 1.0;
	vec4 sh = -step(h, vec4(0.0));

	vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
	vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

	vec3 p0 = vec3(a0.xy,h.x);
	vec3 p1 = vec3(a0.zw,h.y);
	vec3 p2 = vec3(a1.xy,h.z);
	vec3 p3 = vec3(a1.zw,h.w);

	//Normalise gradients
	vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
	p0 *= norm.x;
	p1 *= norm.y;
	p2 *= norm.z;
	p3 *= norm.w;

	// Mix final noise value
	vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
	m = m * m;
	return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
								dot(p2,x2), dot(p3,x3) ) );
}

float snoise(in vec4 v) {
	const vec4  C = vec4( 0.138196601125011,  // (5 - sqrt(5))/20  G4
						0.276393202250021,  // 2 * G4
						0.414589803375032,  // 3 * G4
						-0.447213595499958); // -1 + 4 * G4

	// First corner
	vec4 i  = floor(v + dot(v, vec4(.309016994374947451)) ); // (sqrt(5) - 1)/4
	vec4 x0 = v -   i + dot(i, C.xxxx);

	// Other corners

	// Rank sorting originally contributed by Bill Licea-Kane, AMD (formerly ATI)
	vec4 i0;
	vec3 isX = step( x0.yzw, x0.xxx );
	vec3 isYZ = step( x0.zww, x0.yyz );
	//  i0.x = dot( isX, vec3( 1.0 ) );
	i0.x = isX.x + isX.y + isX.z;
	i0.yzw = 1.0 - isX;
	//  i0.y += dot( isYZ.xy, vec2( 1.0 ) );
	i0.y += isYZ.x + isYZ.y;
	i0.zw += 1.0 - isYZ.xy;
	i0.z += isYZ.z;
	i0.w += 1.0 - isYZ.z;

	// i0 now contains the unique values 0,1,2,3 in each channel
	vec4 i3 = clamp( i0, 0.0, 1.0 );
	vec4 i2 = clamp( i0-1.0, 0.0, 1.0 );
	vec4 i1 = clamp( i0-2.0, 0.0, 1.0 );

	//  x0 = x0 - 0.0 + 0.0 * C.xxxx
	//  x1 = x0 - i1  + 1.0 * C.xxxx
	//  x2 = x0 - i2  + 2.0 * C.xxxx
	//  x3 = x0 - i3  + 3.0 * C.xxxx
	//  x4 = x0 - 1.0 + 4.0 * C.xxxx
	vec4 x1 = x0 - i1 + C.xxxx;
	vec4 x2 = x0 - i2 + C.yyyy;
	vec4 x3 = x0 - i3 + C.zzzz;
	vec4 x4 = x0 + C.wwww;

	// Permutations
	i = mod289(i);
	float j0 = permute( permute( permute( permute(i.w) + i.z) + i.y) + i.x);
	vec4 j1 = permute( permute( permute( permute (
				i.w + vec4(i1.w, i2.w, i3.w, 1.0 ))
			+ i.z + vec4(i1.z, i2.z, i3.z, 1.0 ))
			+ i.y + vec4(i1.y, i2.y, i3.y, 1.0 ))
			+ i.x + vec4(i1.x, i2.x, i3.x, 1.0 ));

	// Gradients: 7x7x6 points over a cube, mapped onto a 4-cross polytope
	// 7*7*6 = 294, which is close to the ring size 17*17 = 289.
	vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0) ;

	vec4 p0 = grad4(j0,   ip);
	vec4 p1 = grad4(j1.x, ip);
	vec4 p2 = grad4(j1.y, ip);
	vec4 p3 = grad4(j1.z, ip);
	vec4 p4 = grad4(j1.w, ip);

	// Normalise gradients
	vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
	p0 *= norm.x;
	p1 *= norm.y;
	p2 *= norm.z;
	p3 *= norm.w;
	p4 *= taylorInvSqrt(dot(p4,p4));

	// Mix contributions from the five corners
	vec3 m0 = max(0.6 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
	vec2 m1 = max(0.6 - vec2(dot(x3,x3), dot(x4,x4)            ), 0.0);
	m0 = m0 * m0;
	m1 = m1 * m1;
	return 49.0 * ( dot(m0*m0, vec3( dot( p0, x0 ), dot( p1, x1 ), dot( p2, x2 )))
				+ dot(m1*m1, vec2( dot( p3, x3 ), dot( p4, x4 ) ) ) ) ;
}

vec2 snoise2( vec2 x ){
	float s  = snoise(vec2( x ));
	float s1 = snoise(vec2( x.y - 19.1, x.x + 47.2 ));
	return vec2( s , s1 );
}

vec3 snoise3( vec3 x ){
	float s  = snoise(vec3( x ));
	float s1 = snoise(vec3( x.y - 19.1 , x.z + 33.4 , x.x + 47.2 ));
	float s2 = snoise(vec3( x.z + 74.2 , x.x - 124.5 , x.y + 99.4 ));
	return vec3( s , s1 , s2 );
}

vec3 snoise3( vec4 x ){
	float s  = snoise(vec4( x ));
	float s1 = snoise(vec4( x.y - 19.1 , x.z + 33.4 , x.x + 47.2, x.w ));
	float s2 = snoise(vec4( x.z + 74.2 , x.x - 124.5 , x.y + 99.4, x.w ));
	return vec3( s , s1 , s2 );
}

#endif


varying vec3 vWorldPosition;

uniform sampler2D u_gradient_ramp;
uniform float u_gradient_ramp_min;
uniform float u_gradient_ramp_max;
uniform vec3 u_gradient_scale;
uniform vec3 u_gradient_noise_speed;
uniform vec2 u_gradient_grain_scale;
uniform vec2 u_gradient_grain_offset;
uniform float u_time;

void main() {
	float grain_offset = snoise(
	vec3(
		vWorldPosition.x * u_gradient_grain_scale.x + 100.0,
		vWorldPosition.y * u_gradient_grain_scale.y + 50.0,
		u_time * 0.01
	)
	);

	float n = snoise(
	vec3(
		vWorldPosition.x * u_gradient_scale.x + u_time * u_gradient_noise_speed.x + grain_offset * u_gradient_grain_offset.x,
		vWorldPosition.y * u_gradient_scale.y + u_time * u_gradient_noise_speed.y + grain_offset * u_gradient_grain_offset.y,
		vWorldPosition.z * u_gradient_scale.z + u_time * u_gradient_noise_speed.z
	)
	);

	n = mix(u_gradient_ramp_min, u_gradient_ramp_max, n);

	vec4 texColor = texture(u_gradient_ramp, vec2(n, 0.0));
	gl_FragColor = vec4(texColor.rgb, 1.0);
}
`;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mapRange = (value: number, inMin: number, inMax: number, outMin: number, outMax: number) => {
	return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
};

export const NodxWaveCanvas: React.FC = () => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
	const sceneRef = useRef<THREE.Scene | null>(null);
	const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
	const clockRef = useRef<THREE.Clock | null>(null);
	const mainMeshRef = useRef<THREE.Mesh | null>(null);
	const gradientMeshRef = useRef<THREE.Mesh | null>(null);
	const gradientSceneRef = useRef<THREE.Scene | null>(null);
	const gradientRenderTargetRef = useRef<THREE.WebGLRenderTarget | null>(null);
	const animationFrameId = useRef<number | null>(null);

	const [isMobile, setIsMobile] = useState(false);
	const [height, setHeight] = useState(10); // Default non-zero value

	useEffect(() => {
		const onResize = () => {
			const mobile = window.innerWidth <= 600;
			setIsMobile(mobile);
			setHeight(mobile ? window.innerWidth / 80 : window.innerWidth / 100);
		};
		onResize(); // Set initial values
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	const startingNoiseAmp = 1;
	const endingNoiseAmp = 1.3;
	const vertexDensity = 40;
	const width = 8;
	const widthSegments = width * vertexDensity;
	const heightSegments = height * vertexDensity;
	const radius = 0.1;
	const halfCircum = radius * Math.PI;
	const quartCircum = halfCircum / 2;

	const uniformsRef = useRef({
		u_time: { value: 0 },
		u_noise_amp: { value: startingNoiseAmp },
		u_noise_speed: { value: 0.03 },
		u_noise_translate_speed: { value: -0.05 },
		u_noise_scale: { value: new THREE.Vector2(0.2, 0.45) },
		u_incline: { value: new THREE.Vector3(0.2, 0, 0) },
		u_offset: { value: 0.05 },
		u_edge_reflection_min: { value: 0 },
		u_edge_reflection_max: { value: 1 },
		u_gradient_ramp: { value: null as THREE.Texture | null },
		u_gradient_ramp_min: { value: 0.5 },
		u_gradient_ramp_max: { value: -0.3 },
		u_gradient_scale: { value: new THREE.Vector3(0.15, 1, 1) },
		u_gradient_noise_speed: { value: new THREE.Vector3(0.06, 0.05, 0) },
		u_gradient_grain_scale: { value: new THREE.Vector2(1.5, 0) },
		u_gradient_grain_offset: { value: new THREE.Vector2(0.07, 0) },
	});

	const foldPlane = useCallback((geometry: THREE.PlaneGeometry) => {
		const positionAttribute = geometry.getAttribute('position');
		for (let i = 0; i < positionAttribute.count; i += 1) {
			const x = positionAttribute.getX(i);
			const y = positionAttribute.getY(i);
			const z = positionAttribute.getZ(i);

			const vec = new THREE.Vector3(x, y, z);

			if (vec.x < -quartCircum) {
				vec.z += radius;
			} else if (vec.x < quartCircum) {
				vec.z = Math.cos(mapRange(vec.x, -quartCircum, quartCircum, 0, Math.PI)) * radius;
				vec.x = Math.cos(mapRange(vec.x, -quartCircum, quartCircum, -Math.PI / 2, Math.PI / 2)) * radius - quartCircum;
			} else {
				vec.z -= radius;
				vec.x = -vec.x;
			}
			positionAttribute.setXYZ(i, vec.x, vec.y, vec.z);
		}
		positionAttribute.needsUpdate = true;
	}, [quartCircum, radius]);

	const transformPlane = useCallback((geometry: THREE.PlaneGeometry) => {
		const positionAttribute = geometry.getAttribute('position');
		const euler = new THREE.Euler(Math.PI / 2, 0, Math.PI / 2);
		for (let i = 0; i < positionAttribute.count; i += 1) {
			const x = positionAttribute.getX(i);
			const y = positionAttribute.getY(i);
			const z = positionAttribute.getZ(i);
			const vec = new THREE.Vector3(x, y, z);
			vec.applyEuler(euler);
			positionAttribute.setXYZ(i, vec.x, vec.y, vec.z);
		}
		positionAttribute.needsUpdate = true;
	}, []);

	const animateIntro = useCallback((startTime: number) => {
		const duration = 3000; // 3 seconds
		const introAnimation = (currentTime: number) => {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1); // 0 to 1

			// Simple easing function (e.g., easeOutQuad)
			const easedProgress = progress * (2 - progress);

			if (uniformsRef.current) {
				uniformsRef.current.u_noise_amp.value = lerp(startingNoiseAmp, endingNoiseAmp, easedProgress);
				uniformsRef.current.u_noise_scale.value.y = lerp(0.15, 0.34, easedProgress);
				uniformsRef.current.u_noise_scale.value.x = lerp(0.05, 0.2, easedProgress);
			}

			if (progress < 1) {
				animationFrameId.current = requestAnimationFrame(introAnimation);
			}
		};
		animationFrameId.current = requestAnimationFrame(introAnimation);
	}, [startingNoiseAmp, endingNoiseAmp]);

	useEffect(() => {
		const currentCanvas = canvasRef.current;
		if (!currentCanvas || height === 10) return;

		// Renderer
		const renderer = new THREE.WebGLRenderer({
			canvas: currentCanvas,
			antialias: true,
			alpha: true, // Enable transparency
		});
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(currentCanvas.clientWidth, currentCanvas.clientHeight);
		renderer.setClearColor(0xffffff, 0); // White with 0 opacity
		rendererRef.current = renderer;

		// Scene and Camera
		const scene = new THREE.Scene();
		sceneRef.current = scene;

		const camera = new THREE.PerspectiveCamera(
			75,
			currentCanvas.clientWidth / currentCanvas.clientHeight,
			0.1,
			1000
		);
		camera.zoom = 4;
		camera.position.y = -0.2;
		camera.position.z = isMobile ? 13 : 10;
		camera.updateProjectionMatrix();
		cameraRef.current = camera;

		// Clock
		const clock = new THREE.Clock();
		clockRef.current = clock;

		// Gradient Texture and Material
		const textureLoader = new THREE.TextureLoader();
		const gradientRampTexture = textureLoader.load("https://images.ctfassets.net/fzn2n1nzq965/6FlvDJnget42zcLGvWPWW8/282726ca965f03513ecc624b5edc752a/gradient-v2.png");
		gradientRampTexture.wrapS = THREE.ClampToEdgeWrapping;
		gradientRampTexture.wrapT = THREE.ClampToEdgeWrapping;
		uniformsRef.current.u_gradient_ramp.value = gradientRampTexture;

		const gradientMaterial = new THREE.ShaderMaterial({
			vertexShader: `
				varying vec3 vWorldPosition;
				void main() {
					vec4 worldPosition = modelMatrix * vec4(position, 1.0);
					vWorldPosition = worldPosition.xyz;
					gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
				}
			`,
			fragmentShader: GRADIENT_FRAGMENT_SHADER,
			uniforms: uniformsRef.current,
			side: THREE.DoubleSide,
		});
		const gradientGeometry = new THREE.PlaneGeometry(20, 20);
		const gradientMesh = new THREE.Mesh(gradientGeometry, gradientMaterial);
		gradientMesh.translateZ(-5); // Push it back
		gradientMeshRef.current = gradientMesh;

		const gradientScene = new THREE.Scene();
		gradientSceneRef.current = gradientScene;
		gradientScene.add(gradientMesh);

		const gradientRenderTarget = new THREE.WebGLRenderTarget(1000, 1000, {
			wrapS: THREE.ClampToEdgeWrapping,
			wrapT: THREE.ClampToEdgeWrapping,
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			format: THREE.RGBAFormat,
		});
		gradientRenderTargetRef.current = gradientRenderTarget;

		// Main Wave Mesh
		const geometry = new THREE.PlaneGeometry(width, height, widthSegments, heightSegments);
		foldPlane(geometry);
		transformPlane(geometry);
		geometry.computeVertexNormals();
		geometry.computeTangents(); // Required for tangent attribute in shader

		const material = new THREE.ShaderMaterial({
			vertexShader: VERTEX_SHADER,
			fragmentShader: FRAGMENT_SHADER,
			uniforms: {
				...uniformsRef.current,
				u_env_texture: { value: gradientRenderTarget.texture },
			},
		});
		const mainMesh = new THREE.Mesh(geometry, material);
		mainMeshRef.current = mainMesh;
		scene.add(mainMesh);

		// Animation Loop
		const animate = () => {
			if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !clockRef.current || !gradientSceneRef.current || !gradientRenderTargetRef.current) return;

			uniformsRef.current.u_time.value = clockRef.current.getElapsedTime();

			// Render gradient scene to render target
			rendererRef.current.setRenderTarget(gradientRenderTargetRef.current);
			rendererRef.current.render(gradientSceneRef.current, cameraRef.current);
			rendererRef.current.setRenderTarget(null); // Reset render target

			// Render main scene
			rendererRef.current.render(sceneRef.current, cameraRef.current);

			animationFrameId.current = requestAnimationFrame(animate);
		};

		// Handle Resize
		const handleResize = () => {
			if (currentCanvas) {
				renderer.setSize(currentCanvas.clientWidth, currentCanvas.clientHeight);
				camera.aspect = currentCanvas.clientWidth / currentCanvas.clientHeight;
				camera.position.z = isMobile ? 13 : 10;
				camera.updateProjectionMatrix();
			}
		};

		window.addEventListener('resize', handleResize);

		// Start intro animation
		animateIntro(performance.now());
		animate();

		// Cleanup
		return () => {
			if (animationFrameId.current) {
				cancelAnimationFrame(animationFrameId.current);
			}
			window.removeEventListener('resize', handleResize);
			if (rendererRef.current) {
				rendererRef.current.dispose();
			}
			if (gradientRampTexture) {
				gradientRampTexture.dispose();
			}
			if (gradientRenderTargetRef.current) {
				gradientRenderTargetRef.current.dispose();
			}
			if (mainMeshRef.current) {
				mainMeshRef.current.geometry.dispose();
				(mainMeshRef.current.material as THREE.ShaderMaterial).dispose();
			}
			if (gradientMeshRef.current) {
				gradientMeshRef.current.geometry.dispose();
				(gradientMeshRef.current.material as THREE.ShaderMaterial).dispose();
			}
		};
	}, [isMobile, foldPlane, transformPlane, animateIntro, height, width, widthSegments, heightSegments, quartCircum, radius, endingNoiseAmp, startingNoiseAmp]);

	return <canvas ref={canvasRef} className="nodx-wave-canvas" />;
};