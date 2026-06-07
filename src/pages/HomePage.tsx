import { Ban, CheckCircle2, Coffee, Droplets, Fish, Leaf, PlayCircle, RefreshCw, Sparkles, Wheat } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { StatusMessage } from "@/components/StatusMessage";
import { useAuth } from "@/components/AuthProvider";
import { Playlist } from "@/components/Playlist";
import { VideoCard } from "@/components/VideoCard";
import { fetchPlaylistsWithVideos, isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { PlaylistWithVideos, VideoRecord, VideoSummary } from "@/lib/types";
import { enrichVideos } from "@/lib/video-utils";

type HomePageCache = {
  cacheKey: string;
  videos: VideoSummary[];
  playlists: PlaylistWithVideos[];
};

let homePageCache: HomePageCache | null = null;

const achievementStats = [
  { label: "مشروع منجز", value: 450 },
  { label: "عميل راضي", value: 2800 },
  { label: "تقييم", value: 4 },
  { label: "خدمات", value: 6 }
];

const tayyibatSlides = [
  {
    badge: "البداية الصحيحة",
    title: "نظام الطيبات",
    description:
      "نظام غذائي متكامل وضعه الدكتور ضياء العوضي رحمه الله، يقوم على تناول الطيبات واجتناب الخبائث.",
    highlight: "تناول الطيبات واجتناب الخبائث",
    chips: ["منهج غذائي", "وعي بالجسم", "اختيار نظيف"],
    tone: "green"
  },
  {
    badge: "أصل النظام",
    title: "القاعدة الذهبية",
    description:
      "كُل فقط لما تجوع.. وتوقف قبل ما تشبع. هذه القاعدة تضبط وقت الأكل وكميته، وتمنح الجهاز الهضمي راحة كافية بين الوجبات.",
    highlight: "كُل فقط لما تجوع",
    chips: ["جوع حقيقي", "توقف مبكر", "راحة للهضم"],
    tone: "emerald"
  },
  {
    badge: "المسموحات الأساسية",
    title: "الطيبات",
    description:
      "الأرز، البطاطس، التمر، العسل، زيت الزيتون، السمن البلدي، القهوة، والشاي الأخضر من أبرز الطيبات في النظام.",
    highlight: "أطعمة واضحة وبسيطة",
    chips: ["أرز", "بطاطس", "تمر", "عسل", "زيت زيتون"],
    tone: "gold"
  },
  {
    badge: "باعتدال",
    title: "البروتينات المسموحة",
    description:
      "لحم الضأن، لحم الجمل، الأرانب، الحمام، السمان، والسمك البحري البري. تؤكل هذه البروتينات باعتدال وليست بشكل يومي.",
    highlight: "تؤكل باعتدال وليس يوميا",
    chips: ["ضأن", "جمل", "أرانب", "سمك بحري"],
    tone: "orange"
  },
  {
    badge: "اجتناب الخبائث",
    title: "الخبائث الممنوعة",
    description:
      "الدقيق الأبيض وكل ما يصنع منه، البيض، الدجاج بكل أنواعه، اللبن ومشتقاته، كل الخضار الورقية، البصل، والثوم.",
    highlight: "منع واضح بدون تداخل",
    chips: ["دقيق أبيض", "بيض", "دجاج", "لبن", "ورقيات"],
    tone: "red"
  }
];


const allowedFoodGroups = [
  {
    title: "الحبوب والنشويات",
    description: "مصادر طاقة بسيطة وواضحة ضمن اختيارات الطيبات.",
    items: ["الأرز", "البطاطس", "البطاطا", "الذرة"],
    tone: "allowed",
    icon: <Wheat size={24} aria-hidden="true" />
  },
  {
    title: "الدهون الطيبة",
    description: "دهون طبيعية بأصل واضح وتستخدم باعتدال.",
    items: ["زيت الزيتون", "السمن البلدي", "زيت جوز الهند"],
    tone: "gold",
    icon: <Droplets size={24} aria-hidden="true" />
  },
  {
    title: "المشروبات",
    description: "مشروبات هادئة بعيدة عن التعقيد والإضافات.",
    items: ["الماء", "القهوة", "الشاي الأخضر", "الأعشاب"],
    tone: "earth",
    icon: <Coffee size={24} aria-hidden="true" />
  },
  {
    title: "البروتينات",
    description: "اختيارات بروتينية تؤكل باعتدال وليس بشكل يومي.",
    items: ["لحم الضأن", "لحم الجمل", "السمك البحري", "الأرانب"],
    tone: "allowed",
    icon: <Fish size={24} aria-hidden="true" />
  },
  {
    title: "اجتناب الخبائث",
    description: "تنبيه بصري سريع للعناصر التي يجب الابتعاد عنها.",
    items: ["الدقيق الأبيض", "الدجاج", "البيض", "الألبان", "الورقيات"],
    tone: "danger",
    icon: <Ban size={24} aria-hidden="true" />
  }
];


type TayyibatSliderVariant = "wide" | "side";

type TayyibatSliderProps = {
  activeSlideIndex: number;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
  variant?: TayyibatSliderVariant;
  sideLabel?: string;
};

function TayyibatSlider({
  activeSlideIndex,
  onPrevious,
  onNext,
  onSelect,
  variant = "wide",
  sideLabel
}: TayyibatSliderProps) {
  const activeTayyibatSlide = tayyibatSlides[activeSlideIndex];

  return (
    <section
      className={`tayyibat-slider-section tayyibat-slider-section--${variant} overflow-x-hidden`}
      aria-label={sideLabel ?? "سلايدات تعريفية عن نظام الطيبات"}
    >
      {sideLabel ? <span className="tayyibat-side-label">{sideLabel}</span> : null}

      <div className={`tayyibat-slide-card tayyibat-slide-${activeTayyibatSlide.tone}`}>
        <div className="tayyibat-slide-content">
          <span className="tayyibat-slide-badge">
            <Sparkles size={16} aria-hidden="true" />
            {activeTayyibatSlide.badge}
          </span>
          <h1>{activeTayyibatSlide.title}</h1>
          <p>{activeTayyibatSlide.description}</p>
          <div className="tayyibat-slide-highlight">{activeTayyibatSlide.highlight}</div>
          <div className="tayyibat-slide-chips" aria-label="نقاط مختصرة">
            {activeTayyibatSlide.chips.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
        </div>

        <div className="tayyibat-slide-visual" aria-hidden="true">
          <div className="tayyibat-orbit tayyibat-orbit-one" />
          <div className="tayyibat-orbit tayyibat-orbit-two" />
          <div className="tayyibat-zone-stack">
            <span className="zone-pill zone-green">الأخضر</span>
            <span className="zone-pill zone-yellow">الأصفر</span>
            <span className="zone-pill zone-orange">البرتقالي</span>
            <span className="zone-pill zone-red">الأحمر</span>
          </div>
        </div>
      </div>

      <div className="tayyibat-slider-controls" aria-label="التحكم في السلايدات">
        <button className="tayyibat-slider-arrow" type="button" onClick={onNext} aria-label="السلايد التالي">
          التالي
        </button>
        <div className="tayyibat-slider-dots" role="tablist" aria-label="اختيار السلايد">
          {tayyibatSlides.map((slide, index) => (
            <button
              key={slide.title}
              className={index === activeSlideIndex ? "active" : ""}
              type="button"
              onClick={() => onSelect(index)}
              aria-label={`عرض سلايد ${slide.title}`}
              aria-pressed={index === activeSlideIndex}
            />
          ))}
        </div>
        <button className="tayyibat-slider-arrow" type="button" onClick={onPrevious} aria-label="السلايد السابق">
          السابق
        </button>
      </div>
    </section>
  );
}


function GoldenPlateIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="19" />
      <circle cx="32" cy="32" r="10" />
      <path d="M13 13v18" />
      <path d="M18 13v18" />
      <path d="M13 22h5" />
      <path d="M49 13v38" />
      <path d="M45 13c7 7 7 15 0 22" />
    </svg>
  );
}

function GoldenStomachIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M35 8c-2 7 1 12 8 15 9 4 12 13 8 22-4 10-16 14-27 11-10-3-16-12-14-22 1-7 6-12 13-14 6-2 8-5 8-12" />
      <path d="M28 22c5 7 3 14-5 19" />
      <path d="M41 34c-4-4-9-4-14 0" />
    </svg>
  );
}

function GoldenDigestionIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M32 52s-20-11-20-26c0-7 5-12 12-12 4 0 7 2 8 5 1-3 4-5 8-5 7 0 12 5 12 12 0 15-20 26-20 26Z" />
      <path d="M24 30c5-5 11-5 16 0" />
      <path d="M24 38c5 4 11 4 16 0" />
    </svg>
  );
}

const goldenRulePrinciples = [
  {
    number: "01",
    text: "تأكل فقط عند الجوع الحقيقي",
    icon: <GoldenPlateIcon />
  },
  {
    number: "02",
    text: "تتوقف عن الأكل قبل أن تشبع",
    icon: <GoldenStomachIcon />
  },
  {
    number: "03",
    text: "تعطي جهازك الهضمي راحة كافية بين الوجبات",
    icon: <GoldenDigestionIcon />
  }
];

function GoldenRuleHero() {
  return (
    <section className="golden-rule-hero" dir="rtl" aria-label="القاعدة الذهبية في نظام الطيبات">
      <div className="golden-rule-hero__shell">
        <div className="golden-rule-hero__content">
          <span className="golden-rule-hero__badge">
            <Sparkles size={18} aria-hidden="true" />
            القاعدة الذهبية
          </span>

          <h1 className="golden-rule-hero__title">
            كُل فقط لما تجوع..
            <br />
            وتوقف قبل ما تشبع
          </h1>

          <p className="golden-rule-hero__subtitle">
            هذه هي القاعدة الذهبية التي أكد عليها الدكتور ضياء العوضي رحمه الله في كل محاضراته.
          </p>

          <div className="golden-rule-hero__divider" aria-hidden="true">
            <span />
          </div>
        </div>

        <div className="golden-rule-hero__cards" aria-label="مبادئ القاعدة الذهبية">
          {goldenRulePrinciples.map((principle) => (
            <article className="golden-rule-hero__card" key={principle.number}>
              <div className="golden-rule-hero__icon">{principle.icon}</div>
              <strong className="golden-rule-hero__number">{principle.number}</strong>
              <p>{principle.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}



function AllowedFoodsSection() {
  return (
    <section id="tayyibat-allowed" className="tayyibat-allowed-section" aria-label="الطيبات المسموحة">
      <div className="section-head">
        <div>
          <span className="eyebrow">
            <Leaf size={16} aria-hidden="true" />
            دليل طبيعي سريع
          </span>
          <h2>الطيبات المسموحة</h2>
          <p>بطاقات مختصرة تساعد الزائر على فهم الاختيارات الأساسية بسرعة وهدوء.</p>
        </div>
      </div>

      <div className="tayyibat-allowed-grid">
        {allowedFoodGroups.map((group) => (
          <article className={`tayyibat-allowed-card ${group.tone}`} key={group.title}>
            <div className="tayyibat-allowed-icon">{group.icon}</div>
            <div>
              <h3>{group.title}</h3>
              <p>{group.description}</p>
            </div>
            <div className="tayyibat-allowed-chips">
              {group.items.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}


function formatCounterValue(value: number) {
  return value.toLocaleString("ar-SA");
}

function AnimatedStatCard({ label, value }: { label: string; value: number }) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const counterRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    const counter = counterRef.current;

    if (!counter || hasAnimated) {
      return;
    }

    let timer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        setHasAnimated(true);
        counter.dataset.animated = "true";
        observer.disconnect();

        const duration = 2000;
        const frameMs = 50;
        const increment = value / (duration / frameMs);
        let current = 0;

        timer = window.setInterval(() => {
          current += increment;

          if (current >= value) {
            setCount(value);
            window.clearInterval(timer);
            return;
          }

          setCount(Math.floor(current));
        }, frameMs);
      },
      {
        threshold: 0.5,
        rootMargin: "0px"
      }
    );

    observer.observe(counter);

    return () => {
      observer.disconnect();

      if (timer) {
        window.clearInterval(timer);
      }
    };
  }, [hasAnimated, value]);

  return (
    <div className="stat-card">
      <h3 ref={counterRef} data-target={value}>
        {formatCounterValue(count)}
      </h3>
      <p>{label}</p>
    </div>
  );
}

export function HomePage() {
  const { isLoading: authLoading, isAdmin } = useAuth();
  const cacheKey = "public";
  const cachedHomePage = homePageCache?.cacheKey === cacheKey ? homePageCache : null;
  const [videos, setVideos] = useState<VideoSummary[]>(cachedHomePage?.videos ?? []);
  const [playlists, setPlaylists] = useState<PlaylistWithVideos[]>(cachedHomePage?.playlists ?? []);
  const [isLoading, setIsLoading] = useState(!cachedHomePage);
  const [error, setError] = useState("");
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const goToPreviousSlide = () => {
    setActiveSlideIndex((current) => (current === 0 ? tayyibatSlides.length - 1 : current - 1));
  };

  const goToNextSlide = () => {
    setActiveSlideIndex((current) => (current === tayyibatSlides.length - 1 ? 0 : current + 1));
  };

  const loadVideos = useCallback(async (force = false) => {
    const cached = homePageCache?.cacheKey === cacheKey ? homePageCache : null;

    if (cached && !force) {
      setVideos(cached.videos);
      setPlaylists(cached.playlists);
      setIsLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(!cached);
    setError("");

    const [videoResult, playlistResult] = await Promise.allSettled([
      supabase.from("videos").select("*").order("created_at", { ascending: false }),
      fetchPlaylistsWithVideos(true)
    ]);

    if (videoResult.status === "rejected" || videoResult.value.error) {
      setError("تعذر تحميل الفيديوهات. تحقق من إعدادات Supabase وقواعد الوصول.");
      if (!cached) {
        setVideos([]);
        setPlaylists([]);
      }
      setIsLoading(false);
      return;
    }

    let nextPlaylists: PlaylistWithVideos[] = [];

    if (playlistResult.status === "fulfilled") {
      nextPlaylists = playlistResult.value;
    }

    const enriched = await enrichVideos((videoResult.value.data ?? []) as VideoRecord[], true);
    homePageCache = { cacheKey, videos: enriched, playlists: nextPlaylists };
    setVideos(enriched);
    setPlaylists(nextPlaylists);
    setIsLoading(false);
  }, [cacheKey]);

  const visiblePlaylists = playlists.filter((playlist) => playlist.videos.length > 0);

  useEffect(() => {
    if (!authLoading) {
      void loadVideos(true);
    }
  }, [authLoading, loadVideos]);

  return (
    <section className="home-layout overflow-x-hidden" dir="rtl">
      <section className="hero-section hero-section--direct overflow-x-hidden" aria-label="منصة الطيبات للمشاهدة المباشرة">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles size={16} aria-hidden="true" />
            منصة فيديوهات الطيبات
          </span>
          <h1>شاهد فيديوهات نظام الطيبات مباشرة بدون تسجيل.</h1>
          <p>
            دروس ومقاطع نظام الطيبات للدكتور ضياء العوضي رحمه الله في مكان واحد، بتجربة عربية هادئة وسريعة
            تفتح الفيديو فوراً بدون بريد إلكتروني أو خطوات إضافية.
          </p>

          <div className="hero-trust-list" aria-label="مزايا المشاهدة">
            <span>
              <CheckCircle2 size={17} aria-hidden="true" />
              مشاهدة فورية
            </span>
            <span>
              <CheckCircle2 size={17} aria-hidden="true" />
              بدون حساب
            </span>
            <span>
              <CheckCircle2 size={17} aria-hidden="true" />
              مناسب للجوال
            </span>
          </div>

          <div className="hero-actions flex-wrap gap-3">
            <a className="button transition-all duration-200" href="#latest-videos">
              <PlayCircle size={18} aria-hidden="true" />
              شاهد أحدث الفيديوهات
            </a>
            <a className="button secondary transition-all duration-200" href="#tayyibat-allowed">
              <Leaf size={17} aria-hidden="true" />
              تصفح الطيبات المسموحة
            </a>
          </div>
        </div>

        <div className="hero-panel" aria-label="ملخص المنصة">
          <div className="hero-visual-card" aria-hidden="true">
            <div className="hero-visual-pattern" />
            <div className="hero-visual-play">
              <PlayCircle size={46} aria-hidden="true" />
            </div>
            <div className="hero-visual-lines">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="hero-stats" aria-label="إحصائيات مختصرة">
            <div className="hero-stat">
              <strong>{videos.length}</strong>
              <span>فيديو متاح</span>
            </div>
            <div className="hero-stat">
              <strong>بدون</strong>
              <span>تسجيل دخول</span>
            </div>
            <div className="hero-stat">
              <strong>فوري</strong>
              <span>تشغيل مباشر</span>
            </div>
          </div>
        </div>
      </section>

      {!isSupabaseConfigured ? (
        <StatusMessage title="إعداد Supabase مطلوب" tone="error">
          أضف القيم في ملف .env.local ثم شغل التطبيق مرة أخرى.
        </StatusMessage>
      ) : null}

      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
      {isLoading ? <div className="empty-state">جار تحميل الفيديوهات...</div> : null}

      {!isLoading ? (
        <section id="latest-videos" className="tayyibat-video-showcase overflow-x-hidden" aria-label="أحدث الفيديوهات">
          <div className="section-head latest-videos-head">
            <div>
              <span className="eyebrow">
                <PlayCircle size={16} aria-hidden="true" />
                المشاهدة المباشرة
              </span>
              <h2>أحدث الفيديوهات</h2>
              <p>اختر أي فيديو وابدأ المشاهدة فوراً بدون تسجيل أو تحويل لصفحة دخول.</p>
            </div>

            <button className="button secondary button-small transition-all duration-200" type="button" onClick={() => loadVideos(true)}>
              <RefreshCw size={16} aria-hidden="true" />
              تحديث القائمة
            </button>
          </div>

          {visiblePlaylists.length > 0 ? (
            <section className="featured-playlists-panel overflow-x-hidden" aria-label="قوائم الفيديوهات المختارة">
              <div className="section-head compact featured-playlists-head">
                <div>
                  <span className="eyebrow">
                    <Sparkles size={16} aria-hidden="true" />
                    قوائم مرتبة
                  </span>
                  <h2>قوائم مختارة حسب الموضوع</h2>
                  <p>كل قائمة تظهر هنا بعد إضافة فيديو واحد على الأقل إليها من لوحة الإدارة.</p>
                </div>
              </div>

              <div className="playlist-stack overflow-x-hidden">
                {visiblePlaylists.map((playlist) => (
                  <Playlist key={playlist.id} playlist={playlist} canOpen />
                ))}
              </div>
            </section>
          ) : null}

          {isAdmin && playlists.length > 0 && visiblePlaylists.length === 0 ? (
            <div className="empty-state compact-empty playlist-admin-hint">
              قوائم التشغيل موجودة في لوحة الإدارة، لكنها لا تظهر للزوار حتى تضيف إليها فيديو واحداً على الأقل.
            </div>
          ) : null}

          <section className="latest-videos-grid-panel" aria-label="كل الفيديوهات الحديثة">
            <div className="section-head compact latest-grid-head">
              <div>
                <span className="eyebrow">
                  <PlayCircle size={16} aria-hidden="true" />
                  المكتبة العامة
                </span>
                <h2>كل الفيديوهات</h2>
              </div>
            </div>

            {videos.length === 0 ? <div className="empty-state">لا توجد فيديوهات منشورة حاليا.</div> : null}

            {videos.length > 0 ? (
              <div className="video-grid">
                {videos.map((video) => (
                  <VideoCard key={video.id} video={video} canOpen showStats />
                ))}
              </div>
            ) : null}
          </section>
        </section>
      ) : null}

      <AllowedFoodsSection />

      <GoldenRuleHero />

      {!isLoading ? (
        <TayyibatSlider
          activeSlideIndex={activeSlideIndex}
          onPrevious={goToPreviousSlide}
          onNext={goToNextSlide}
          onSelect={setActiveSlideIndex}
        />
      ) : null}
    </section>
  );
}
