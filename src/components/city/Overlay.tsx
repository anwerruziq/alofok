import { useCallback, useEffect, useRef, useState } from "react";
import { SECTIONS } from "./CityScene";

// ─── Animation Wrapper ──────────────────────────────────────────────────────
function FadeInView({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-1000 ease-out transform ${
        isVisible ? "opacity-100 translate-y-0 blur-none" : "opacity-0 translate-y-12 blur-sm"
      } ${className}`}
    >
      {children}
    </div>
  );
}

// ─── Mobile Joystick ────────────────────────────────────────────────────────
function MobileJoystick({
  scrollRef,
  lookRef,
}: {
  scrollRef: React.MutableRefObject<number>;
  lookRef: React.MutableRefObject<number>;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(false);
  const originRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const axisRef = useRef({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  // Continuously apply movement while joystick is held
  const tick = useCallback(() => {
    const { x, y } = axisRef.current;
    // Reasonable deadzone to prevent drift from tiny touches
    if (Math.abs(x) > 0.08 || Math.abs(y) > 0.08) {
      // Vertical axis: move along path (negative y = forward)
      const progressDelta = -y * 0.004;
      let newP = scrollRef.current + progressDelta;
      newP = Math.max(0, Math.min(1, newP));
      scrollRef.current = newP;

      // Horizontal axis: rotate camera look (reversed direction)
      const lookDelta = -x * 0.04;
      let newLook = lookRef.current + lookDelta;
      newLook = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, newLook));
      lookRef.current = newLook;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [scrollRef, lookRef]);

  const startTick = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stopTick = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const handleStart = useCallback((clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    originRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    activeRef.current = true;
    setActive(true);
    startTick();
  }, [startTick]);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!activeRef.current || !knobRef.current) return;
    const RADIUS = 36;
    let dx = clientX - originRef.current.x;
    let dy = clientY - originRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > RADIUS) {
      const scale = RADIUS / dist;
      dx *= scale;
      dy *= scale;
    }
    // Normalise to -1..1
    axisRef.current = { x: dx / RADIUS, y: dy / RADIUS };
    knobRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }, []);

  const handleEnd = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    axisRef.current = { x: 0, y: 0 };
    stopTick();
    if (knobRef.current) {
      knobRef.current.style.transform = "translate(-50%, -50%)";
    }
    // Snap look back to center
    lookRef.current = 0;
  }, [stopTick, lookRef]);

  useEffect(() => {
    // Only handle touchmove/touchend globally when joystick is actively being used
    const onTouchMove = (e: TouchEvent) => {
      if (!activeRef.current) return;
      e.preventDefault();
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchEnd = () => {
      if (!activeRef.current) return;
      handleEnd();
    };
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      stopTick();
    };
  }, [handleMove, handleEnd, stopTick]);

  return (
    <div
      className="md:hidden"
      style={{
        position: "fixed",
        bottom: "28px",
        left: "28px",
        zIndex: 30,
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "none",
      }}
    >
      {/* Outer ring / base */}
      <div
        ref={baseRef}
        onTouchStart={(e) => {
          e.preventDefault();
          handleStart(e.touches[0].clientX, e.touches[0].clientY);
        }}
        style={{
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: active
            ? "rgba(191,161,95,0.15)"
            : "rgba(255,255,255,0.06)",
          border: active
            ? "2px solid rgba(191,161,95,0.7)"
            : "2px solid rgba(191,161,95,0.3)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: active
            ? "0 0 24px rgba(191,161,95,0.4), inset 0 0 20px rgba(191,161,95,0.08)"
            : "0 0 12px rgba(191,161,95,0.1), inset 0 0 10px rgba(0,0,0,0.2)",
          position: "relative",
          transition: "background 0.2s, border 0.2s, box-shadow 0.2s",
          cursor: "pointer",
        }}
      >
        {/* Cross guides */}
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{ width: "60%", height: 1, background: "rgba(191,161,95,0.25)", position: "absolute" }} />
          <div style={{ width: 1, height: "60%", background: "rgba(191,161,95,0.25)", position: "absolute" }} />
        </div>

        {/* Directional arrows */}
        {["top", "bottom", "left", "right"].map((dir) => (
          <div
            key={dir}
            style={{
              position: "absolute",
              ...(dir === "top" ? { top: 8, left: "50%", transform: "translateX(-50%)" } : {}),
              ...(dir === "bottom" ? { bottom: 8, left: "50%", transform: "translateX(-50%)" } : {}),
              ...(dir === "left" ? { left: 8, top: "50%", transform: "translateY(-50%)" } : {}),
              ...(dir === "right" ? { right: 8, top: "50%", transform: "translateY(-50%)" } : {}),
              width: 0,
              height: 0,
              opacity: 0.35,
              borderTop: dir === "bottom" ? "5px solid rgba(191,161,95,0.8)" : "5px solid transparent",
              borderBottom: dir === "top" ? "5px solid rgba(191,161,95,0.8)" : "5px solid transparent",
              borderLeft: dir === "right" ? "5px solid rgba(191,161,95,0.8)" : "5px solid transparent",
              borderRight: dir === "left" ? "5px solid rgba(191,161,95,0.8)" : "5px solid transparent",
            }}
          />
        ))}

        {/* Knob */}
        <div
          ref={knobRef}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: active
              ? "radial-gradient(circle at 35% 35%, rgba(255,230,150,0.95), rgba(191,161,95,0.85))"
              : "radial-gradient(circle at 35% 35%, rgba(255,220,130,0.7), rgba(191,161,95,0.5))",
            border: "1.5px solid rgba(255,220,130,0.6)",
            boxShadow: active
              ? "0 0 16px rgba(191,161,95,0.8), 0 2px 8px rgba(0,0,0,0.5)"
              : "0 0 8px rgba(191,161,95,0.4), 0 2px 6px rgba(0,0,0,0.4)",
            transition: activeRef.current ? "none" : "transform 0.25s cubic-bezier(0.22,1,0.36,1), box-shadow 0.2s",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Label */}
      <div style={{
        textAlign: "center",
        marginTop: 6,
        fontFamily: "monospace",
        fontSize: 9,
        letterSpacing: "0.15em",
        color: "rgba(191,161,95,0.6)",
        textTransform: "uppercase",
        userSelect: "none",
      }}>
        تحريك
      </div>
    </div>
  );
}


function NavBar() {
  const [isOpen, setIsOpen] = useState(false);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => { document.body.style.overflow = "auto"; };
  }, [isOpen]);

  const links = [
    { label: "الجولة", href: "#" },
    { label: "مشاريعنا", href: "#projects" },
    { label: "خدماتنا", href: "#services" },
    { label: "تواصل معنا", href: "#contact" },
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-[60] bg-[#0c1424]/40 backdrop-blur-md border-b border-white/10 px-6 md:px-12 py-3 flex justify-between items-center transition-all animate-fade-in">
        {/* Logo */}
        <a href="/" className="flex items-center gap-4 group transition-all duration-300 pointer-events-auto">
          <div className="relative overflow-hidden transition-transform duration-300 group-hover:scale-105">
            <img src="/img/logo/logo-color.png" alt="الأفق للمقاولات" className="h-16 md:h-20 w-auto object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display font-bold text-base md:text-xl tracking-[0.05em] text-white group-hover:text-primary transition-colors">الأفق العقارية</span>
            <span className="text-[10px] md:text-xs text-white/50 font-mono tracking-wider">AL OFOQ REAL ESTATE</span>
          </div>
        </a>
        
        {/* Desktop Menu */}
        <div className="hidden md:flex gap-10 items-center">
          {links.map((link, i) => (
            <a 
              key={i} 
              href={link.href} 
              className="group relative font-mono text-xs text-white/70 hover:text-white transition-colors uppercase tracking-[0.15em]"
            >
              {link.label}
              <span className="absolute -bottom-2 left-0 right-0 h-[1px] bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-right duration-300" />
            </a>
          ))}
          <a href="#contact" className="ml-4 border border-primary/30 hover:border-primary px-6 py-2.5 rounded-full font-mono text-xs tracking-widest text-primary transition-all hover:bg-primary/10 hover:shadow-[0_0_15px_rgba(191,161,95,0.2)]">
            احجز موعداً
          </a>
        </div>

        {/* Mobile Hamburger (Custom Animated) */}
        <button 
          className="md:hidden relative w-8 h-8 flex flex-col justify-center items-end gap-1.5 z-[70] focus:outline-none group" 
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className={`h-[1px] bg-white transition-all duration-300 ${isOpen ? "w-6 rotate-45 translate-y-[7px]" : "w-8 group-hover:w-6"}`} />
          <span className={`h-[1px] bg-white transition-all duration-300 ${isOpen ? "w-0 opacity-0" : "w-6"}`} />
          <span className={`h-[1px] bg-white transition-all duration-300 ${isOpen ? "w-6 -rotate-45 -translate-y-[7px]" : "w-4 group-hover:w-8"}`} />
        </button>
      </nav>

      {/* Fullscreen Mobile Menu Overlay */}
      <div 
        className={`fixed inset-0 z-[55] bg-black/95 backdrop-blur-3xl flex flex-col justify-center items-center transition-all duration-500 ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none delay-200"}`}
      >
        <div className="flex flex-col items-center gap-8 w-full px-6">
          {links.map((link, i) => (
            <a 
              key={i} 
              href={link.href} 
              onClick={() => setIsOpen(false)} 
              className={`font-display text-2xl sm:text-3xl text-white tracking-widest transition-all duration-500 transform hover:text-primary ${isOpen ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
              style={{ transitionDelay: `${isOpen ? 100 + i * 100 : 0}ms` }}
            >
              {link.label}
            </a>
          ))}
          
          <div 
            className={`mt-12 flex flex-col items-center gap-6 transition-all duration-500 transform ${isOpen ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
            style={{ transitionDelay: `${isOpen ? 500 : 0}ms` }}
          >
            <div className="w-12 h-[1px] bg-primary/30" />
            <a href="#contact" onClick={() => setIsOpen(false)} className="text-primary font-mono tracking-widest text-sm uppercase border border-primary/20 px-8 py-3 rounded-full hover:bg-primary/10 transition-colors">
              تواصل مع المبيعات
            </a>
            <div className="flex gap-8 mt-2 text-white/40 text-xs font-mono tracking-wider">
              <a href="#" className="hover:text-primary transition-colors">IG</a>
              <a href="#" className="hover:text-primary transition-colors">TW</a>
              <a href="#" className="hover:text-primary transition-colors">IN</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Overlay({
  scrollRef,
  lookRef,
}: {
  scrollRef: React.MutableRefObject<number>;
  lookRef: React.MutableRefObject<number>;
}) {
  const [progress, setProgress] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const [introVisible, setIntroVisible] = useState(true);
  const [introAnimated, setIntroAnimated] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevProgress = useRef(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const tourHeight = SECTIONS.length * el.clientHeight;
      const p = tourHeight > 0 ? Math.min(1, el.scrollTop / tourHeight) : 0;
      scrollRef.current = p;
      setProgress(p);
      prevProgress.current = p;

      if (idleTimer.current) clearTimeout(idleTimer.current);

      if (p < 0.08) {
        setIntroVisible(false);
        setIntroAnimated(false);
        idleTimer.current = setTimeout(() => {
          setIntroVisible(true);
          setTimeout(() => setIntroAnimated(true), 30);
        }, 700);
      } else {
        setIntroVisible(false);
        setIntroAnimated(false);
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    
    // Custom Touch Controls for Mobile
    let isTouch = false;
    let lastY = 0;
    let lastX = 0;
    let accumulatedDy = 0;
    let velocityY = 0;
    let lastTime = 0;
    let rafId: number | null = null;

    const updateControls = (dy: number, dx: number) => {
      const tourHeight = SECTIONS.length * el.clientHeight;
      if (tourHeight <= 0) return;
      
      // Smooth, consistent speed — lower multiplier prevents erratic jumps
      const progressDelta = -dy * 0.001;
      let newP = scrollRef.current + progressDelta;
      newP = Math.max(0, Math.min(1, newP));
      
      scrollRef.current = newP;
      setProgress(newP);
      el.scrollTop = newP * tourHeight;

      // Horizontal Look (only if dx is significant)
      if (Math.abs(dx) > 2) {
        const lookDelta = -dx * 0.003;
        let newLook = lookRef.current + lookDelta;
        newLook = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, newLook));
        lookRef.current = newLook;
      }
    };

    const applyInertia = () => {
      if (!isTouch && Math.abs(velocityY) > 0.05) {
        // Only apply inertia to vertical movement (progress), not look
        updateControls(velocityY * 12, 0);
        velocityY *= 0.92; // gentle decay
        rafId = requestAnimationFrame(applyInertia);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (window.innerWidth > 768) return;
      const tourHeight = SECTIONS.length * el.clientHeight;
      if (el.scrollTop >= tourHeight) return; // allow native scroll for footer

      isTouch = true;
      accumulatedDy = 0;
      if (rafId) cancelAnimationFrame(rafId);
      lastY = e.touches[0].clientY;
      lastX = e.touches[0].clientX;
      lastTime = performance.now();
      velocityY = 0;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTouch || window.innerWidth > 768) return;
      
      // Prevent native scroll
      if (e.cancelable) e.preventDefault();
      
      const now = performance.now();
      const dt = Math.max(1, now - lastTime);
      const touch = e.touches[0];
      const dy = touch.clientY - lastY;
      const dx = touch.clientX - lastX;
      
      // Only process movement if the delta exceeds a minimum threshold
      // This prevents micro-jitter from causing direction reversals
      if (Math.abs(dy) < 1.5 && Math.abs(dx) < 1.5) return;

      // Track accumulated direction to filter out noise
      accumulatedDy += dy;
      
      // Use exponential moving average for velocity to smooth out spikes
      velocityY = velocityY * 0.6 + (dy / dt) * 0.4;
      
      updateControls(dy, dx);
      
      lastY = touch.clientY;
      lastX = touch.clientX;
      lastTime = now;
    };

    const handleTouchEnd = () => {
      isTouch = false;
      // Snap look back to front when finger is released
      lookRef.current = 0;
      // Only apply inertia if the velocity is meaningful and consistent
      if (Math.abs(velocityY) > 0.08) {
        rafId = requestAnimationFrame(applyInertia);
      }
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd);

    setTimeout(() => {
      setIntroVisible(true);
      setTimeout(() => setIntroAnimated(true), 80);
    }, 300);
    
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [scrollRef, lookRef]);

  return (
    <>
      <NavBar />
      <MobileJoystick scrollRef={scrollRef} lookRef={lookRef} />

      {/* Intro Company Name */}
      <div
        className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-center px-4 pb-16 md:pb-24"
        style={{
          visibility: introVisible ? "visible" : "hidden",
          opacity: introAnimated ? 1 : 0,
          transform: introAnimated ? "translateY(0px) scale(1)" : "translateY(30px) scale(0.94)",
          transition: introAnimated
            ? "opacity 0.9s cubic-bezier(0.22,1,0.36,1), transform 0.9s cubic-bezier(0.22,1,0.36,1)"
            : "none",
        }}
      >
        {/* Logo above hero title */}
        <div className="z-10 pointer-events-auto transform transition-all duration-700 hover:scale-105">
          <a href="/">
            <img
              src="/img/logo/logo-color.png"
              alt="الأفق للمقاولات"
              className="h-32 sm:h-40 md:h-52 w-auto object-contain drop-shadow-[0_4px_20px_rgba(191,161,95,0.4)]"
            />
          </a>
        </div>
        {/* Hero text image */}
        <img
          src="/img/logo/hero-text-new.png"
          alt="الأفق العقارية"
          className="-mt-10 sm:-mt-16 md:-mt-24 lg:-mt-32 h-40 sm:h-52 md:h-64 lg:h-80 w-auto object-contain drop-shadow-[0_4px_20px_rgba(255,255,255,0.3)]"
        />
        <div
          className="bg-primary mt-4 md:mt-6 mb-3 md:mb-4"
          style={{
            height: "1px",
            width: introAnimated ? "8rem" : "0rem",
            boxShadow: "0 0 15px var(--primary)",
            transition: "width 0.8s cubic-bezier(0.22,1,0.36,1) 0.25s",
          }}
        />
        <p
          className="font-mono text-[10px] sm:text-xs md:text-sm tracking-[0.3em] md:tracking-[0.4em] text-primary/80 uppercase animate-pulse text-center"
          style={{
            opacity: introAnimated ? 1 : 0,
            transition: "opacity 0.6s ease 0.5s",
          }}
        >
          اسحب لاستكشاف مشاريعنا
        </p>
      </div>

      {/* Bottom label */}
      <div className="pointer-events-none fixed bottom-0 left-1/2 -translate-x-1/2 z-20 py-2 md:py-3 font-mono text-[8px] md:text-[10px] tracking-widest text-primary/60 text-center whitespace-nowrap">
        الأفق العقارية · حيث تبدأ استثماراتك بخطوة واثقة
      </div>

      {/* Scroll indicator on mobile */}
      <div className="md:hidden pointer-events-none fixed right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1">
        <div className="w-0.5 h-16 bg-primary/20 rounded-full overflow-hidden">
          <div
            className="w-full bg-primary rounded-full transition-all duration-300"
            style={{ height: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* Scrollable layer */}
      <div ref={scrollerRef} className="fixed inset-0 z-10 overflow-y-scroll overflow-x-hidden pt-20 overscroll-y-none" style={{ WebkitOverflowScrolling: "touch" }}>
        {SECTIONS.map((s, i) => (
          <div key={i} className="h-screen w-full pointer-events-none" />
        ))}
        <div className="h-screen" />

        {/* Content after 3D tour */}
        <div className="relative z-20 bg-background/95 backdrop-blur-md border-t border-primary/20 pointer-events-auto">
          <ProjectsSection />
          <ServicesSection />
          <ContactSection />
          <FooterSection />
        </div>
      </div>
    </>
  );
}

function ProjectsSection() {
  const projects = [
    {
      src: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
      name: "برج الأعمال المركزي",
      type: "تشييد أبراج مكتبية",
    },
    {
      src: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80",
      name: "تنفيذ مجمع النخيل",
      type: "أعمال البناء والتشطيب",
    },
    {
      src: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80",
      name: "مشروع الطرق والجسور",
      type: "بنية تحتية ومقاولات عامة",
    },
    {
      src: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80",
      name: "تطوير المستشفى العام",
      type: "مرافق طبية وكهروميكانيكا",
    },
  ];
  return (
    <section id="projects" className="py-20 md:py-32 px-4 sm:px-6 md:px-12 max-w-7xl mx-auto scroll-mt-20">
      <FadeInView className="mb-12 md:mb-20 text-center flex flex-col items-center">
        <span className="text-primary text-xs tracking-[0.3em] uppercase mb-4 font-mono">Our Projects</span>
        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 tracking-wide">
          أبرز <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/50">إنجازاتنا</span>
        </h2>
        <div className="w-16 h-1 bg-primary rounded-full mb-6"></div>
        <p className="font-mono text-sm text-white/60 max-w-2xl mx-auto leading-loose">
          نفخر بتنفيذ مشاريع عملاقة تعكس التزامنا بالجودة، الدقة، والاحترافية في قطاع المقاولات والبناء.
        </p>
      </FadeInView>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        {projects.map((p, i) => (
          <FadeInView key={i} delay={i * 150} className="group relative aspect-[4/3] md:aspect-[16/10] overflow-hidden rounded-2xl bg-black border border-white/10 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/90 z-10 transition-opacity duration-500 group-hover:opacity-80" />
            <img
              src={p.src}
              alt={p.name}
              className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:opacity-60"
            />
            <div className="absolute inset-0 z-20 flex flex-col justify-end p-6 md:p-10 transform transition-transform duration-500 translate-y-4 group-hover:translate-y-0">
              <p className="font-mono text-xs md:text-sm text-primary uppercase tracking-widest mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                {p.type}
              </p>
              <h3 className="font-display text-2xl md:text-3xl font-bold text-white mb-2">
                {p.name}
              </h3>
              <div className="w-0 h-0.5 bg-primary transition-all duration-500 group-hover:w-1/3 mt-2"></div>
            </div>
          </FadeInView>
        ))}
      </div>
    </section>
  );
}

function ServicesSection() {
  const services = [
    {
      title: "البناء والتشييد",
      desc: "تنفيذ المشاريع الإنشائية الكبرى للمباني السكنية، التجارية، والحكومية بأعلى معايير الجودة.",
      details: "نوفر خدمات البناء المتكاملة من الحفر ووضع الأساسات حتى تسليم المفتاح، بالاعتماد على أفضل الكوادر الهندسية والمعدات الحديثة لضمان المتانة والأمان."
    },
    {
      title: "أعمال التشطيبات",
      desc: "أعمال تشطيبات داخلية وخارجية راقية تشمل الأرضيات، الدهانات، الأسقف المعلقة، وتكسيات الواجهات.",
      details: "نلتزم بتقديم أرقى مستويات التشطيب باستخدام مواد عالية الجودة وتصاميم عصرية تناسب متطلبات العملاء وتعكس الفخامة في كل تفصيل."
    },
    {
      title: "الأعمال الكهروميكانيكية (MEP)",
      desc: "تصميم وتنفيذ أنظمة التكييف، السباكة، الكهرباء، ومكافحة الحريق بأحدث التقنيات.",
      details: "نقوم بتركيب شبكات كهروميكانيكية معقدة تلبي أعلى اشتراطات السلامة العالمية، مع توفير حلول موفرة للطاقة وصديقة للبيئة."
    },
    {
      title: "البنية التحتية",
      desc: "تنفيذ أعمال البنية التحتية للمخططات وشبكات الطرق، والصرف الصحي، وتمديدات المياه والكهرباء.",
      details: "نساهم في تطوير المجتمعات من خلال تأسيس شبكات بنية تحتية قوية ومستدامة تتحمل التوسعات المستقبلية بكفاءة عالية."
    },
    {
      title: "الترميم والصيانة",
      desc: "خدمات ترميم المباني القديمة وصيانتها وقائياً لتمديد العمر الافتراضي للمنشآت.",
      details: "نعيد إحياء المباني القديمة من خلال تدعيم هياكلها الإنشائية وتجديد مظهرها، بالإضافة لتوفير عقود صيانة دورية للمرافق."
    },
    {
      title: "أعمال الديكور والنجارة",
      desc: "تنفيذ الديكورات الخشبية والجبسية والأثاث المدمج بدقة واحترافية.",
      details: "نمتلك ورش متخصصة لتنفيذ كافة الأعمال الخشبية والديكورات الداخلية لتتناغم مع التصميم المعماري للمكان."
    },
    {
      title: "إدارة المشاريع",
      desc: "تخطيط ومراقبة وتوجيه المشاريع لضمان إنجازها في الوقت المحدد وفي حدود الميزانية.",
      details: "فريق الإدارة لدينا يتولى التنسيق بين جميع المقاولين والموردين، وإصدار تقارير دورية تضمن سير العمل بشفافية واحترافية."
    },
    {
      title: "استشارات هندسية",
      desc: "تقديم استشارات فنية وحلول هندسية مبتكرة لتخطي التحديات الإنشائية وتحسين الأداء.",
      details: "ندرس المخططات المعمارية والإنشائية، ونقترح بدائل وحلول تساهم في تقليل التكلفة دون المساس بمعايير الجودة أو السلامة."
    }
  ];

  const [selected, setSelected] = useState<number | null>(null);

  return (
    <>
      <section id="services" className="py-20 md:py-32 px-4 sm:px-6 md:px-12 max-w-7xl mx-auto border-t border-white/5 scroll-mt-20 relative">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
        
        <FadeInView className="mb-12 md:mb-20 text-center flex flex-col items-center relative z-10">
          <span className="text-primary text-xs tracking-[0.3em] uppercase mb-4 font-mono">Our Services</span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 tracking-wide">
            خدمات <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/50">المقاولات</span>
          </h2>
          <div className="w-16 h-1 bg-primary rounded-full mb-6"></div>
          <p className="font-mono text-sm text-white/60 max-w-2xl mx-auto leading-loose">
            نقدم حلول بناء شاملة تبدأ من وضع حجر الأساس وصولاً للتسليم النهائي بمهنية واحترافية عالية.
          </p>
        </FadeInView>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
          {services.map((s, i) => (
            <FadeInView
              key={i}
              delay={i * 100}
              className="group relative bg-black/40 backdrop-blur-xl border border-white/10 hover:border-primary/50 rounded-2xl p-8 cursor-pointer transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(191,161,95,0.15)]"
            >
              <div onClick={() => setSelected(i)} className="absolute inset-0 z-20" />
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />
              <div className="relative z-10 pointer-events-none">
                <div className="flex items-center justify-between mb-6">
                  <div className="text-primary font-mono text-2xl font-light opacity-60 group-hover:opacity-100 transition-opacity">
                    0{i + 1}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <svg className="w-4 h-4 text-white/40 group-hover:text-primary transition-colors transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                </div>
                <h3 className="font-display text-xl font-bold text-white mb-4 group-hover:text-primary transition-colors">
                  {s.title}
                </h3>
                <p className="font-mono text-xs md:text-sm text-white/50 leading-loose line-clamp-3">
                  {s.desc}
                </p>
              </div>
            </FadeInView>
          ))}
        </div>
      </section>

      {/* Modal Detail */}
      {selected !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 transition-all duration-300"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 md:p-12 max-w-2xl w-full relative shadow-[0_0_50px_rgba(191,161,95,0.1)] transform scale-100 opacity-100 transition-all duration-300"
            onClick={e => e.stopPropagation()}
          >
            <button 
              className="absolute top-6 left-6 text-white/40 hover:text-white transition-colors"
              onClick={() => setSelected(null)}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="text-primary font-mono text-xl mb-4">0{selected + 1} //</div>
            <h3 className="text-3xl font-display font-bold text-white mb-6">
              {services[selected].title}
            </h3>
            <div className="w-12 h-1 bg-primary rounded-full mb-8"></div>
            <p className="text-white/80 font-mono leading-loose mb-6 text-sm md:text-base">
              {services[selected].desc}
            </p>
            <p className="text-white/60 font-mono leading-loose text-sm">
              {services[selected].details}
            </p>
            <button
              className="mt-10 px-8 py-3 bg-transparent border border-primary text-primary hover:bg-primary hover:text-black font-bold uppercase tracking-widest text-xs transition-all rounded-full"
              onClick={() => setSelected(null)}
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </>
  );
}





function ContactSection() {
  return (
    <section id="contact" className="py-16 md:py-24 px-4 sm:px-6 md:px-12 max-w-3xl mx-auto border-t border-primary/10 scroll-mt-20">
      <div className="mb-8 md:mb-12 text-center">
        <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-3 md:mb-4 uppercase tracking-widest neon-text">
          تواصل معنا
        </h2>
        <p className="font-mono text-xs sm:text-sm text-foreground/60 leading-relaxed">
          فريق المبيعات جاهز للرد على استفساراتك حول مشاريعنا.
        </p>
      </div>
      <form className="flex flex-col gap-4 md:gap-6" onSubmit={(e) => e.preventDefault()}>
        <div className="flex flex-col gap-1.5 md:gap-2">
          <label className="font-mono text-[10px] md:text-xs text-primary/80 uppercase tracking-widest">
            الاسم الكريم
          </label>
          <input
            type="text"
            className="bg-black/50 border border-primary/30 rounded p-3 text-white font-mono text-sm focus:outline-none focus:border-primary transition-colors w-full"
            placeholder="أدخل اسمك"
          />
        </div>
        <div className="flex flex-col gap-1.5 md:gap-2">
          <label className="font-mono text-[10px] md:text-xs text-primary/80 uppercase tracking-widest">
            البريد الإلكتروني
          </label>
          <input
            type="email"
            className="bg-black/50 border border-primary/30 rounded p-3 text-white font-mono text-sm focus:outline-none focus:border-primary transition-colors w-full"
            placeholder="user@horizon.estates"
          />
        </div>
        <div className="flex flex-col gap-1.5 md:gap-2">
          <label className="font-mono text-[10px] md:text-xs text-primary/80 uppercase tracking-widest">
            الرسالة أو الاستفسار
          </label>
          <textarea
            rows={4}
            className="bg-black/50 border border-primary/30 rounded p-3 text-white font-mono text-sm focus:outline-none focus:border-primary transition-colors resize-none w-full"
            placeholder="اكتب رسالتك هنا..."
          />
        </div>
        <button className="mt-2 md:mt-4 bg-primary/20 hover:bg-primary/40 border border-primary text-primary font-mono py-3 md:py-4 rounded tracking-[0.15em] md:tracking-[0.2em] transition-all hover:shadow-[0_0_20px_var(--primary)] uppercase text-sm md:text-base">
          إرسال الطلب
        </button>
      </form>
    </section>
  );
}

function FooterSection() {
  return (
    <footer className="border-t border-primary/20 bg-[#060c18]/90 py-12 md:py-16 px-4 md:px-6 text-center flex flex-col items-center justify-center">
      <a href="/" className="mb-4 flex flex-col items-center gap-2 group pointer-events-auto">
        <div className="relative overflow-hidden transition-transform duration-300 group-hover:scale-105">
          <img 
            src="/img/logo/logo-color.png" 
            alt="الأفق للمقاولات" 
            className="h-12 md:h-14 w-auto object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]" 
          />
        </div>
        <div className="font-display text-base md:text-lg tracking-[0.1em] text-white group-hover:text-primary transition-colors mt-2">
          الأفق العقارية
        </div>
        <div className="text-[9px] text-white/40 font-mono tracking-widest uppercase">
          AL OFOQ REAL ESTATE
        </div>
      </a>
      <p className="font-mono text-[11px] md:text-xs text-foreground/50 mb-6 md:mb-8 max-w-md mx-auto leading-relaxed">
        شريكك الموثوق في التطوير العقاري. حيث تبدأ استثماراتك بخطوة واثقة.
      </p>
      <div className="flex justify-center gap-4 md:gap-6 font-mono text-xs text-primary/60 flex-wrap">
        <a href="#" className="hover:text-primary transition-colors">TWITTER</a>
        <a href="#" className="hover:text-primary transition-colors">INSTAGRAM</a>
        <a href="#" className="hover:text-primary transition-colors">LINKEDIN</a>
      </div>
      <div className="mt-8 md:mt-12 font-mono text-[9px] md:text-[10px] text-foreground/30 pointer-events-none">
        © 2026 الأفق للمقاولات العامة. جميع الحقوق محفوظة.
      </div>
    </footer>
  );
}

