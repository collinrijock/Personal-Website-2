import { useState } from 'react';
import { user, signIn, signOut } from '../hooks/useAuth';

export default function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false);

    const navButtonClasses =
        'font-sans cursor-pointer text-white text-opacity-50 transition-all duration-200 hover:text-opacity-100 origin-bottom hover:scale-110';

    const navItems = ['GitHub', 'LinkedIn', 'Twitter'];

    return (
        <nav className="flex justify-between items-center p-4 bg-black bg-opacity-20 shadow-2xl">
            <div className="flex items-center">
                <div className="flex flex-col">
                    <h1 className="font-sans text-white text-xl md:text-2xl">Collin Rijock</h1>
                    <h2 className="font-mono text-white text-sm opacity-60 tracking-widest md:text-base">PERSONAL</h2>
                </div>
            </div>
            <div className="hidden md:flex items-center space-x-4">
                {navItems.map((item, index) => (
                    <button key={index} className={navButtonClasses}>
                        {item}
                    </button>
                ))}
                <button
                    className={navButtonClasses}
                    onClick={signIn}
                >
                    Log in
                </button>
                <a
                    className="font-sans flex flex-row items-center text-white text-opacity-50 transition-opacity duration-200 hover:text-opacity-100 group"
                    href="#letstalk"
                >
                    Let&#39;s Talk
                    <svg
                        className="w-5 h-5 inline-block ml-1 group-hover:translate-x-1 transition-transform duration-200"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                    </svg>
                </a>
            </div>
            <div className="md:hidden">
                <button onClick={() => setMenuOpen(!menuOpen)}>
                    <svg
                        className="w-6 h-6"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        {menuOpen ? (
                            <path d="M6 18L18 6M6 6l12 12" />
                        ) : (
                            <path d="M4 6h16M4 12h16M4 18h16" />
                        )}
                    </svg>
                </button>
                {menuOpen && (
                    <div className={"absolute z-10 right-0 mt-2 w-48 py-2 bg-black bg-opacity-20 transition-opacity rounded shadow-xl duration-2000 ease-in" + (menuOpen ? 'opacity-100' : 'opacity-0')}>
                        {navItems.map((item, index) => (
                            <button
                                key={index}
                                className={`${navButtonClasses} block w-full px-4 py-2 text-left`}
                                onClick={() => setMenuOpen(false)}
                            >
                                {item}
                            </button>
                        ))}
                        <a
                            className={`${navButtonClasses} flex flex-row items-center w-full px-4 py-2 text-left group`}
                            href="#letstalk"
                            onClick={() => setMenuOpen(false)}
                        >
                            Let&#39;s Talk
                            <svg
                                className="w-5 h-5 inline-block ml-1 group-hover:translate-x-1 transition-transform duration-200"

                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                                />
                            </svg>
                        </a>
                    </div>
                )}
            </div>
        </nav>
    );
}

