import { Lock, RefreshCw, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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

const TAYYIBAT_SLIDE_DELAY_MS = 6000;

const tayyibatSlides = [
  {
    badge: "التعريف",
    title: "نظام الطيبات",
    description:
      "نظام غذائي متكامل وضعه الدكتور ضياء العوضي رحمه الله، يقوم على تناول الطيبات واجتناب الخبائث، وتنظيم وقت الأكل بما يخفف العبء عن الجسم.",
    highlight: "تناول الطيبات واجتناب الخبائث",
    chips: ["منهج غذائي", "أكل عند الجوع", "راحة للجهاز الهضمي"],
    tone: "green"
  },
  {
    badge: "القاعدة الذهبية",
    title: "كُل فقط لما تجوع.. وتوقف قبل ما تشبع",
    description:
      "هذه هي القاعدة التي أكد عليها الدكتور ضياء العوضي رحمه الله في محاضراته: لا تبدأ الطعام إلا عند الجوع الحقيقي، ولا تستمر حتى الامتلاء.",
    highlight: "الجوع الحقيقي قبل الطعام.. والتوقف قبل الشبع",
    chips: ["جوع حقيقي", "توقف قبل الشبع", "راحة بين الوجبات"],
    tone: "emerald"
  },
  {
    badge: "الطيبات",
    title: "الأطعمة الطيبة",
    description:
      "من أبرز الطيبات في النظام: الأرز، البطاطس، التمر، العسل، زيت الزيتون، السمن البلدي، القهوة، والشاي الأخضر.",
    highlight: "أطعمة بسيطة وواضحة المصدر",
    chips: ["أرز", "بطاطس", "تمر", "عسل", "زيت زيتون"],
    tone: "gold"
  },
  {
    badge: "باعتدال",
    title: "البروتينات المسموحة",
    description:
      "يسمح النظام ببعض البروتينات مثل لحم الضأن، لحم الجمل، الأرانب، الحمام، السمان، والسمك البحري البري، على أن تؤكل باعتدال لا بشكل يومي.",
    highlight: "مسموحة باعتدال وليست طعاماً يومياً",
    chips: ["ضأن", "جمل", "أرانب", "سمك بحري"],
    tone: "orange"
  },
  {
    badge: "اجتناب الخبائث",
    title: "الخبائث الممنوعة",
    description:
      "من أبرز الممنوعات: الدقيق الأبيض وكل ما يصنع منه، البيض، الدجاج بكل أنواعه، اللبن ومشتقاته، كل الخضار الورقية، البصل، والثوم.",
    highlight: "الاجتناب أوضح من التخفيف",
    chips: ["دقيق أبيض", "بيض", "دجاج", "لبن", "ورقيات"],
    tone: "red"
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

function formatCounterValue(value: number) {
  return value.toLocaleString("ar-SA");
}


type AllowedTayyibatKey =
  | "rice"
  | "potato"
  | "wheat"
  | "dates"
  | "honey"
  | "oliveOil"
  | "ghee"
  | "coffee"
  | "greenTea";

type AllowedTayyibatItem = {
  key: AllowedTayyibatKey;
  title: string;
  description: string;
};

const allowedTayyibatItems: AllowedTayyibatItem[] = [
  {
    key: "rice",
    title: "الأرز",
    description:
      "من الطيبات الأساسية في النظام، وهو طعام بسيط وواضح يؤكل عند الجوع الحقيقي وبكمية لا تصل إلى الامتلاء."
  },
  {
    key: "potato",
    title: "البطاطس",
    description:
      "تدخل ضمن الأطعمة المسموحة والبسيطة، وتناسب مبدأ الوجبة الواضحة غير المركبة عند الالتزام بالتوقف قبل الشبع."
  },
  {
    key: "wheat",
    title: "البر",
    description:
      "يقصد به القمح الكامل الطبيعي غير المكرر، ويعرض هنا ضمن الطيبات عندما يكون بعيداً عن الدقيق الأبيض ومصنعاته."
  },
  {
    key: "dates",
    title: "التمر",
    description:
      "من الطيبات المباركة والواضحة، ويؤكل باعتدال دون تحويله إلى أكل متكرر يكسر راحة الجهاز الهضمي بين الوجبات."
  },
  {
    key: "honey",
    title: "العسل",
    description:
      "من الطيبات المركزة، لذلك يكون استخدامه بقدر مناسب مع احترام قاعدة الجوع الحقيقي وعدم المبالغة."
  },
  {
    key: "oliveOil",
    title: "زيت الزيتون",
    description:
      "من الدهون الطيبة في النظام، ويستخدم مع الطعام ببساطة واعتدال دون خلطات كثيرة تثقل الهضم."
  },
  {
    key: "ghee",
    title: "السمن البلدي",
    description:
      "من الدهون المسموحة، والمهم أن يؤخذ بقدر مناسب مع الوجبة لا كسبب للإكثار أو الوصول إلى الثقل."
  },
  {
    key: "coffee",
    title: "القهوة",
    description:
      "من المشروبات المسموحة، بشرط ألا تتحول إلى عادة مستمرة تربك إشارات الجوع أو تكسر فترات الراحة."
  },
  {
    key: "greenTea",
    title: "الشاي الأخضر",
    description:
      "مشروب مسموح ضمن إطار البساطة، والأفضل تناوله باعتدال دون إفراط أو اعتماد دائم بين الوجبات."
  }
];

type AllowedTayyibatSectionProps = {
  openItem: AllowedTayyibatKey | null;
  onToggle: (key: AllowedTayyibatKey) => void;
};

function AllowedTayyibatSection({ openItem, onToggle }: AllowedTayyibatSectionProps) {
  return (
    <section className="allowed-tayyibat-section" aria-label="الطيبات المسموحة">
      <div className="allowed-tayyibat-card">
        <div className="allowed-tayyibat-head">
          <span className="allowed-tayyibat-kicker">
            <Sparkles size={15} aria-hidden="true" />
            الطيبات المسموحة
          </span>
          <h2>اختر كلمة لمعرفة شرحها</h2>
          <p>هذه العناصر من الطيبات المذكورة في النظام، اضغط على أي عنصر لعرض شرحه مباشرة تحته.</p>
        </div>

        <div className="allowed-tayyibat-grid">
          {allowedTayyibatItems.map((item) => {
            const isOpen = openItem === item.key;

            return (
              <div className={`allowed-tayyibat-item ${isOpen ? "is-open" : ""}`} key={item.key}>
                <button
                  className="allowed-tayyibat-button"
                  type="button"
                  onClick={() => onToggle(item.key)}
                  aria-expanded={isOpen}
                  aria-controls={`allowed-tayyibat-${item.key}`}
                >
                  <span>{item.title}</span>
                  <span className="allowed-tayyibat-plus" aria-hidden="true">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>

                <div
                  id={`allowed-tayyibat-${item.key}`}
                  className="allowed-tayyibat-explanation"
                  aria-hidden={!isOpen}
                >
                  <div className="allowed-tayyibat-explanation-inner">
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
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
  const { user, isLoading: authLoading } = useAuth();
  const cacheKey = user ? "authenticated" : "anonymous";
  const cachedHomePage = homePageCache?.cacheKey === cacheKey ? homePageCache : null;
  const [videos, setVideos] = useState<VideoSummary[]>(cachedHomePage?.videos ?? []);
  const [playlists, setPlaylists] = useState<PlaylistWithVideos[]>(cachedHomePage?.playlists ?? []);
  const [isLoading, setIsLoading] = useState(!cachedHomePage);
  const [error, setError] = useState("");
  const [isContactSubmitted, setIsContactSubmitted] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [openAllowedTayyibat, setOpenAllowedTayyibat] = useState<AllowedTayyibatKey | null>(null);

  const goToPreviousSlide = () => {
    setActiveSlideIndex((current) => (current === 0 ? tayyibatSlides.length - 1 : current - 1));
  };

  const goToNextSlide = () => {
    setActiveSlideIndex((current) => (current === tayyibatSlides.length - 1 ? 0 : current + 1));
  };

  const toggleAllowedTayyibat = (key: AllowedTayyibatKey) => {
    setOpenAllowedTayyibat((current) => (current === key ? null : key));
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlideIndex((current) => (current === tayyibatSlides.length - 1 ? 0 : current + 1));
    }, TAYYIBAT_SLIDE_DELAY_MS);

    return () => window.clearInterval(timer);
  }, []);

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
      fetchPlaylistsWithVideos(Boolean(user))
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

    const enriched = await enrichVideos((videoResult.value.data ?? []) as VideoRecord[], Boolean(user));
    homePageCache = { cacheKey, videos: enriched, playlists: nextPlaylists };
    setVideos(enriched);
    setPlaylists(nextPlaylists);
    setIsLoading(false);
  }, [cacheKey, user]);

  useEffect(() => {
    if (!authLoading) {
      void loadVideos();
    }
  }, [authLoading, loadVideos]);

  const stats = useMemo(
    () => [
      { label: "فيديو منشور", value: videos.length },
      { label: "إعجاب", value: videos.reduce((total, video) => total + video.likes_count, 0) },
      { label: "تعليق", value: videos.reduce((total, video) => total + video.comments_count, 0) }
    ],
    [videos]
  );

  return (
    <section className="home-layout overflow-x-hidden" dir="rtl">
      <section className="tayyibat-golden-rule-section overflow-x-hidden" aria-label="القاعدة الذهبية في نظام الطيبات">
        <div className="tayyibat-golden-rule-card">
          <div className="tayyibat-golden-rule-copy">
            <span className="tayyibat-golden-rule-kicker">
              <Sparkles size={16} aria-hidden="true" />
              القاعدة الذهبية
            </span>
            <h1>
              كُل فقط لما تجوع..
              <br />
              وتوقف قبل ما تشبع
            </h1>
            <p className="tayyibat-golden-rule-lead">
              هذي هي القاعدة الذهبية التي أكد عليها الدكتور ضياء العوضي رحمه الله في كل محاضراته،
              وهي المدخل العملي لفهم نظام الطيبات: ضبط وقت الأكل، وتقليل الكمية، وترك مساحة راحة للهضم.
            </p>
          </div>

          <div className="tayyibat-golden-principles" aria-label="المبادئ الأساسية للنظام">
            <div className="tayyibat-golden-principle-card">
              <strong>01</strong>
              <span>تأكل فقط عند الجوع الحقيقي</span>
            </div>
            <div className="tayyibat-golden-principle-card">
              <strong>02</strong>
              <span>تتوقف عن الأكل قبل أن تشبع</span>
            </div>
            <div className="tayyibat-golden-principle-card">
              <strong>03</strong>
              <span>تعطي جهازك الهضمي راحة كافية بين الوجبات</span>
            </div>
          </div>
        </div>
      </section>

      <AllowedTayyibatSection openItem={openAllowedTayyibat} onToggle={toggleAllowedTayyibat} />

      <section className="achievement-stats-section overflow-x-hidden" aria-label="إحصائيات الإنجاز">
        <div className="achievement-stat-grid">
          {achievementStats.map((item) => (
            <AnimatedStatCard key={item.label} label={item.label} value={item.value} />
          ))}
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
        <section className="tayyibat-video-showcase overflow-x-hidden" aria-label="منطقة السلايدات والفيديوهات">
          <TayyibatSlider
            activeSlideIndex={activeSlideIndex}
            onPrevious={goToPreviousSlide}
            onNext={goToNextSlide}
            onSelect={setActiveSlideIndex}
          />

          <div className="video-with-side-sliders">
            <aside className="video-side-slider video-side-slider-right" aria-label="سلايدات يمين الفيديوهات">
              <TayyibatSlider
                activeSlideIndex={activeSlideIndex}
                onPrevious={goToPreviousSlide}
                onNext={goToNextSlide}
                onSelect={setActiveSlideIndex}
                variant="side"
                sideLabel="دليل سريع"
              />
            </aside>

            <main className="video-main-column">
              {playlists.length > 0 ? (
                <div className="playlist-stack overflow-x-hidden">
                  {playlists.map((playlist) => (
                    <Playlist key={playlist.id} playlist={playlist} canOpen={Boolean(user)} />
                  ))}
                </div>
              ) : null}

              {videos.length === 0 ? <div className="empty-state">لا توجد فيديوهات منشورة حاليا.</div> : null}

              {videos.length > 0 ? (
                <section className="overflow-x-hidden">
                  <div className="section-head">
                    <div>
                      <h2>أحدث الفيديوهات</h2>
                      <p>المحتوى المنشور يظهر هنا حسب الأحدث أولا.</p>
                    </div>
                  </div>

                  <div className="video-grid">
                    {videos.map((video) => (
                      <VideoCard key={video.id} video={video} canOpen={Boolean(user)} showStats={Boolean(user)} />
                    ))}
                  </div>
                </section>
              ) : null}
            </main>

            <aside className="video-side-slider video-side-slider-left" aria-label="سلايدات يسار الفيديوهات">
              <TayyibatSlider
                activeSlideIndex={activeSlideIndex}
                onPrevious={goToPreviousSlide}
                onNext={goToNextSlide}
                onSelect={setActiveSlideIndex}
                variant="side"
                sideLabel="تصنيف مختصر"
              />
            </aside>
          </div>
        </section>
      ) : null}

      <div className="hero-section overflow-x-hidden">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles size={16} aria-hidden="true" />
            منصة عربية منظمة للفيديوهات
          </span>
          <h1>شاهد، أدر، وتفاعل مع محتوى الفيديو في تجربة واحدة.</h1>
          <p>
            واجهة RTL حديثة تعرض الفيديوهات الطويلة والقصيرة بوضوح، مع قوائم تشغيل أفقية وتسجيل دخول
            للتفاعل ولوحة إدارة للرفع والتحرير والمتابعة.
          </p>
          <div className="hero-actions flex-wrap gap-3">
            {user ? (
              <Link className="button transition-all duration-200" to="/account">
                <ShieldCheck size={17} aria-hidden="true" />
                عرض الحساب
              </Link>
            ) : (
              <Link className="button transition-all duration-200" to="/login">
                <Lock size={17} aria-hidden="true" />
                تسجيل الدخول
              </Link>
            )}
            <button className="button secondary transition-all duration-200" type="button" onClick={() => loadVideos(true)}>
              <RefreshCw size={16} aria-hidden="true" />
              تحديث القائمة
            </button>
          </div>
        </div>

        <div className="hero-panel" aria-label="ملخص المنصة">
          <div className="hero-visual">
            <div className="hero-play">
              <UploadCloud size={26} aria-hidden="true" />
            </div>
          </div>
          <div className="stat-grid">
            {stats.map((item) => (
              <div className="stat-card" key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
