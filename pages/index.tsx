import Head from 'next/head';
import { Gradient } from '../components/Gradient.js';
import { useEffect } from 'react';
import Navbar from '@/components/navbar';
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";

export default function Home() {

  const gradientStyle = {
    width: '100%',
    height: '100%',
    '--gradient-color-1': "#2a4e47",
    '--gradient-color-2': '#f5e4d2',
    '--gradient-color-4': '#0a1d1a',
    '--gradient-color-3': '#ffffff',
  }

  const navButtonClasses =
  'font-sans cursor-pointer text-white text-opacity-50 transition-all duration-200 hover:text-opacity-100';


  useEffect(() => {
    const canvasElement = document.getElementById("gradient-canvas");
    const gradient: any = new Gradient();
    if (canvasElement) {
      gradient.initGradient("#gradient-canvas");
    } else {
      gradient.pause();
    }
  }, []);

  return (
    <>
      <Head>
        <title>Collin Rijock - Personal</title>
        <link rel="icon" href="/favicon.ico" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css?family=Roboto|Roboto+Mono"
        />
      </Head>
      <div className="relative w-full h-screen overflow-hidden">
        <canvas id="gradient-canvas" className='absolute -z-10' style={gradientStyle} data-transition-in />
        <Navbar />
        <main className="flex items-center justify-center w-full h-full">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-4 mix-blend-color-difference opacity-90 text-shadow-xl">
              Building Great Software
            </h1>
            <p className="text-xl opacity-50 text-shadow-xl tracking-widest uppercase">
              design - full stack - machine learning
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
