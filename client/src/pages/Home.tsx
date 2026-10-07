import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, HandHeart, Lock, MessagesSquare, Search, Tag } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { itemService } from "@/services/itemService";
import AnimatedContent from "@/components/reactbits/AnimatedContent";
import BlurText from "@/components/reactbits/BlurText";
import Carousel from "@/components/reactbits/Carousel";
import ChromaGrid from "@/components/reactbits/ChromaGrid";
import CountUp from "@/components/reactbits/CountUp";
import DotGrid from "@/components/reactbits/DotGrid";
import DriftWall from "@/components/reactbits/DriftWall";
import FadeContent from "@/components/reactbits/FadeContent";
import GlareHover from "@/components/reactbits/GlareHover";
import GradientText from "@/components/reactbits/GradientText";
import Magnet from "@/components/reactbits/Magnet";
import ScrollReveal from "@/components/reactbits/ScrollReveal";
import ShinyText from "@/components/reactbits/ShinyText";
import Stack from "@/components/reactbits/Stack";

/* The landing page is public, so it can never show a real listing — and a fresh
   database has no uploads at all. The wall and the stack are drawn from category
   art instead, in the same palette as the item placeholder. */
const CATEGORY_TILES = [
  "phone", "wallet", "keys", "bag", "earbuds", "id-card", "glasses", "bottle",
].map(name => ({ image: `/categories/${name}.svg` }));

const STEPS = [
  {
    number: "01",
    icon: Tag,
    title: "REPORT",
    body: "Post your lost or found item with the structured details that matter.",
  },
  {
    number: "02",
    icon: Search,
    title: "MATCH",
    body: "Search manually, or let UniFind surface possible matches for you.",
  },
  {
    number: "03",
    icon: MessagesSquare,
    title: "CONNECT",
    body: "Message another UIU member safely, inside the university network.",
  },
  {
    number: "04",
    icon: HandHeart,
    title: "REUNITE",
    body: "Verify ownership, hand the item back, and mark the case resolved.",
  },
];

/* The eight categories, paired with the art already used
   for the hero wall. Each card drops the visitor straight into Browse with the
   category filter applied — the listings themselves stay behind sign-in. */
const CATEGORY_CARDS = [
  { name: "Electronics", tile: "phone", note: "Phones, laptops, chargers" },
  { name: "Wallets", tile: "wallet", note: "Purses and card holders" },
  { name: "Keys", tile: "keys", note: "Room, locker, and bike keys" },
  { name: "Bags", tile: "bag", note: "Backpacks and totes" },
  { name: "Accessories", tile: "earbuds", note: "Earbuds, watches, cables" },
  { name: "ID Cards", tile: "id-card", note: "Student and staff IDs" },
  { name: "Clothing", tile: "glasses", note: "Glasses, jackets, scarves" },
  { name: "Other", tile: "bottle", note: "Bottles, umbrellas, books" },
];

/**
 * Public landing page.
 *
 * Listings are private, so nothing here shows an actual item — only anonymous
 * counters and an explanation of how the network works.
 */
export function Home() {
  const { data: stats } = useApi(signal => itemService.publicStats(signal), []);
  const navigate = useNavigate();

  return (
    <>
      <section className="hero">
        {/* Decoration only: aria-hidden, and pointer-events are off in CSS so it
            can never swallow a click meant for the hero copy above it. The dot
            grid is the base texture and the drift wall sits over it, so the
            hero reads as ruled paper with slips passing across. */}
        <div className="uf-dotgrid hero-dots" aria-hidden="true">
          <DotGrid
            dotSize={3}
            gap={26}
            baseColor="#c9d1dd"
            activeColor="#e98b29"
            proximity={110}
            shockRadius={190}
            shockStrength={3}
            returnDuration={1.4}
          />
        </div>

        <div className="uf-driftwall hero-wall" aria-hidden="true">
          <DriftWall
            items={CATEGORY_TILES}
            columns={5}
            tileWidth={180}
            tileHeight={228}
            gap={18}
            speed={18}
            variance={0.35}
            grayscale={false}
            pauseOnHover={false}
          />
        </div>

        <div className="hero-copy">
          <GradientText
            className="uf-gradient hero-eyebrow"
            colors={["#d1761a", "#e98b29", "#f7b96a", "#e98b29", "#d1761a"]}
            animationSpeed={9}
          >
            UIU LOST &amp; FOUND NETWORK
          </GradientText>

          {/* One <h1>, two treatments. BlurText renders a <span> inside it (see
              the reactbits README) so the opening assembles word by word, while
              the closing phrase keeps the shine it was designed with. */}
          <h1 className="hero-headline">
            <BlurText
              as="span"
              className="uf-blurtext"
              text="Lost something? Find it within your"
              animateBy="words"
              direction="top"
              delay={90}
              stepDuration={0.3}
            />{" "}
            <em>
              {/* The base colour stays --accent-strong so the phrase keeps the
                  emphasis the hero was designed with; the shine is a lighter
                  warm tone sweeping through it, never a colour change. */}
              <ShinyText
                text="university community."
                className="uf-shine"
                color="#d1761a"
                shineColor="#f7b96a"
                speed={4}
                spread={100}
              />
            </em>
          </h1>

          <p className="hero-lede">
            UniFind is the private network where UIU students, faculty, and staff report lost and
            found belongings, surface possible matches, and get things back to their owners.
          </p>

          <div className="hero-actions">
            <Magnet padding={70} magnetStrength={6} wrapperClassName="uf-magnet">
              <GlareHover
                className="uf-glare"
                width="auto"
                height="auto"
                background="transparent"
                borderRadius="var(--radius)"
                glareColor="#ffffff"
                glareOpacity={0.45}
                glareAngle={-38}
                glareSize={220}
                transitionDuration={720}
              >
                <Link to="/login" className="btn btn-primary btn-lg">
                  Sign in with UIU email <ArrowRight size={18} />
                </Link>
              </GlareHover>
            </Magnet>
            <Link to="/register" className="btn btn-secondary btn-lg">
              Create account
            </Link>
          </div>

          <p className="hero-note mono-label">
            <Lock size={14} /> PRIVATE TO VERIFIED @*.UIU.AC.BD MEMBERS
          </p>
        </div>

        <div className="hero-panel raised">
          <div className="hero-panel-head">
            <span className="pulse-dot" aria-hidden="true" />
            <span className="mono-label">NETWORK STATUS · ACTIVE</span>
          </div>

          <dl className="hero-stats">
            <div>
              <dt className="mono-label">ACTIVE REPORTS</dt>
              <dd>
                {(stats?.active_reports ?? 0) < 10 && <span aria-hidden="true">0</span>}
                <CountUp to={stats?.active_reports ?? 0} duration={1.3} className="uf-countup" />
              </dd>
            </div>
            <div>
              <dt className="mono-label">POSSIBLE MATCHES</dt>
              <dd>
                {(stats?.possible_matches ?? 0) < 10 && <span aria-hidden="true">0</span>}
                <CountUp to={stats?.possible_matches ?? 0} duration={1.3} className="uf-countup" />
              </dd>
            </div>
            <div>
              <dt className="mono-label">ITEMS REUNITED</dt>
              <dd className="accent">
                {(stats?.items_reunited ?? 0) < 10 && <span aria-hidden="true">0</span>}
                <CountUp to={stats?.items_reunited ?? 0} duration={1.3} className="uf-countup" />
              </dd>
            </div>
          </dl>

          <p className="hero-panel-note">
            Anonymous counters only. Item details, names, and locations stay inside the network.
          </p>
        </div>
      </section>

      <section className="section" id="how-it-works">
        <header className="section-head">
          <p className="mono-label accent">HOW UNIFIND WORKS</p>
          {/* ScrollReveal renders its own <h2>, so it replaces the heading
              rather than sitting inside one. */}
          <ScrollReveal
            containerClassName="uf-reveal"
            textClassName="uf-reveal-text"
            enableBlur
            baseOpacity={0.12}
            baseRotation={2}
            blurStrength={3}
          >
            From a missing item to a real reunion.
          </ScrollReveal>
        </header>

        <div className="step-grid">
          {STEPS.map(({ number, icon: Icon, title, body }, index) => (
            /* Each step fades in slightly after the one before it, so the four
               stages read in order rather than appearing all at once. */
            <FadeContent key={number} blur duration={520} delay={index * 110} threshold={0.25}>
              <article className="step-card raised">
                <span className="mono-label accent">{number}</span>
                <div className="step-icon recessed">
                  <Icon size={20} />
                </div>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            </FadeContent>
          ))}
        </div>

        {/* Below 900px the four-column grid above is hidden and the same steps
            become a draggable carousel — four stacked cards would otherwise
            push the rest of the page off the first screen. */}
        <div className="uf-carousel step-carousel">
          <Carousel
            baseWidth={320}
            autoplay
            autoplayDelay={4200}
            pauseOnHover
            loop
            items={STEPS.map(({ number, icon: Icon, title, body }, index) => ({
              id: index,
              title: `${number} · ${title}`,
              description: body,
              icon: <Icon size={15} />,
            }))}
          />
        </div>
      </section>

      <section className="section categories-section" id="categories">
        <header className="section-head">
          <p className="mono-label accent">BY CATEGORY</p>
          <h2>What goes missing on campus.</h2>
          <p className="section-lede">
            Pick a category to jump straight into a filtered search. The listings themselves stay
            private until you sign in.
          </p>
        </header>

        <AnimatedContent distance={60} duration={0.7} threshold={0.2}>
          <div className="uf-chroma category-chroma">
            <ChromaGrid
              radius={260}
              damping={0.4}
              fadeOut={0.55}
              onSelect={item => navigate(`/browse?category=${encodeURIComponent(item.title)}`)}
              items={CATEGORY_CARDS.map(({ name, tile, note }) => ({
                image: `/categories/${tile}.svg`,
                title: name,
                subtitle: note,
                handle: "BROWSE →",
                borderColor: "#e98b29",
                gradient: "linear-gradient(160deg, #f0f2f5, #d1d9e6)",
              }))}
            />
          </div>
        </AnimatedContent>
      </section>

      <section className="section reunited-section">
        <header className="section-head">
          <p className="mono-label accent">WHAT COMES BACK</p>
          <h2>Phones, wallets, keys, ID cards.</h2>
          <p className="section-lede">
            The things that actually go missing on campus. Drag the top card to shuffle the pile.
          </p>
        </header>

        <div className="uf-stack reunited-stack">
          <Stack
            randomRotation
            sensitivity={140}
            sendToBackOnClick
            cards={CATEGORY_TILES.slice(0, 5).map((tile, index) => (
              <img key={index} src={tile.image} alt="" draggable={false} />
            ))}
          />
        </div>
      </section>

      <section className="section privacy-section" id="privacy">
        <FadeContent blur duration={620} threshold={0.2}>
        <div className="privacy-card raised">
          <div className="step-icon recessed">
            <Lock size={22} />
          </div>
          <div>
            <p className="mono-label accent">BUILT FOR THE UIU COMMUNITY</p>
            <h2>Your belongings stay inside the network.</h2>
            <p>
              Lost and found listings are never public. Registration is restricted to official UIU
              email addresses, and every post, claim, message, and moderation action is checked on
              the server against your university account.
            </p>
          </div>
        </div>
        </FadeContent>
      </section>
    </>
  );
}
