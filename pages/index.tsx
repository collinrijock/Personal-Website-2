import Head from 'next/head';
import { Gradient } from '../components/Gradient.js';
import ThreeJSEnvironment from '../components/Text';
import { useEffect } from 'react';
import Navbar from '@/components/navbar';

export default function Home() {

  const gradientStyle = {
    width: '100%',
    height: '100%',
    '--gradient-color-1': "#000022",
    '--gradient-color-2': '#E7D7C1',
    '--gradient-color-4': '#FD1D64',
    '--gradient-color-3': '#590004',
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
      <div className="relative w-full h-screen overflow-hidden flex flex-col items-center justify-center">
        <canvas id="gradient-canvas" className='absolute -z-10' style={gradientStyle} data-transition-in />
        <Navbar />
        <ThreeJSEnvironment  />
        {/* Add data and a blender image */}
      </div>
    </>
  );
}
