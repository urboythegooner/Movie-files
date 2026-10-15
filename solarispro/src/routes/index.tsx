import { createFileRoute } from '@tanstack/react-router';
import SolarisGame from '@/game/SolarisGame';

export const Route = createFileRoute('/')({
  ssr: false,
  head: () => ({ meta: [
    { title: 'Solaris — Gravity Sandbox' },
    { name: 'description', content: 'Build and explore living solar systems with illuminated planetary surfaces, orbital physics, and cosmic phenomena.' },
    { property: 'og:title', content: 'Solaris — Gravity Sandbox' },
    { property: 'og:description', content: 'Create worlds, shape gravity, and explore your own universe in Solaris.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: SolarisGame,
});