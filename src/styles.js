// Tailwind Configuration and Styles for Zoom RTMS App
// Based on the coupon app styling system

export const getTailwindConfig = () => ({
  theme: {
    extend: {
      colors: {
        'background': '#F5F4F4',
        'page-bg': '#F5F4F4',
        'app-bg': '#FFFFFF',
        'app-bg-alt': '#FFFFFF',
        'app-accent': '#E2DFDF',
        'primary': '#0E141B',
        'accent': '#FFFFFF',
        'secondary': '#D9D5D4',
        'text': '#100C04',
        'text-muted': '#6B7280',
        'button': '#0C5CFF',
        'button-hover': '#0A4EDB',
        'success': '#10b981',
        'error': '#ef4444',
        'warning': '#f59e0b',
      }
    }
  }
});

export const getStyles = () => `
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  html {
    @apply bg-background;
  }
  body {
    @apply bg-page-bg text-text;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  }
  .AppBody {
    @apply bg-page-bg text-text py-4;
  }
  .AppContainer {
    @apply container mx-auto;
  }
  .App {
    @apply max-w-4xl mx-2 md:mx-auto p-8 bg-app-bg rounded-xl shadow-sm;
  }
  .AppFooter {
    @apply mt-4 text-center text-sm;
  }
  .AppFooter a {
    @apply text-primary hover:text-button-hover underline;
  }
  h1 {
    @apply text-3xl font-semibold mb-4 text-primary;
  }
  h2 {
    @apply text-xl font-semibold mb-3 text-primary;
  }
  textarea {
    @apply w-full mb-2 py-2 px-4 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm;
  }
  button {
    @apply bg-button text-white px-4 py-2 rounded-xl hover:bg-button-hover transition-colors;
  }
  button:disabled {
    @apply opacity-50 cursor-not-allowed;
  }
  .transcript-item {
    @apply last:border-b-0;
  }
  .meta {
    @apply text-text-muted text-xs mb-1;
  }
  .text {
    @apply text-text text-sm leading-relaxed;
  }
  .status-connected {
    @apply text-success font-medium;
  }
  .status-disconnected {
    @apply text-error font-medium;
  }
  .status-polling {
    @apply text-warning font-medium;
  }
  .badge {
    @apply inline-flex items-center px-2 py-1 rounded-full text-xs font-medium;
  }
  .badge-tool {
    @apply ml-2 text-button bg-blue-50 border border-blue-200;
  }
  .badge-processing {
    @apply bg-yellow-100 text-yellow-800;
  }
  .badge-error {
    @apply bg-red-100 text-red-800;
  }
  .tool-info {
    @apply text-xs text-text-muted opacity-70;
  }
  .processing-indicator {
    @apply animate-pulse bg-blue-50 rounded-xl p-3 shadow-sm;
  }
  
  /* Markdown styling for AI responses */
  .text p {
    @apply mb-2;
  }
  .text p:last-child {
    @apply mb-0;
  }
  .text strong {
    @apply font-semibold text-primary;
  }
  .text em {
    @apply italic;
  }
  .text code {
    @apply bg-gray-100 px-2 py-0.5 rounded-lg text-xs font-mono;
  }
  .text pre {
    @apply bg-gray-100 p-3 rounded-xl my-2 overflow-x-auto shadow-sm;
  }
  .text pre code {
    @apply bg-transparent p-0;
  }
  .text ul, .text ol {
    @apply ml-4 mb-2;
  }
  .text ul {
    @apply list-disc;
  }
  .text ol {
    @apply list-decimal;
  }
  .text li {
    @apply mb-1;
  }
  .text a {
    @apply text-button underline hover:text-button-hover;
  }
  .text h1, .text h2, .text h3, .text h4 {
    @apply font-semibold text-primary mt-3 mb-2;
  }
  .text h1 {
    @apply text-lg;
  }
  .text h2 {
    @apply text-base;
  }
  .text h3, .text h4 {
    @apply text-sm;
  }
  .text blockquote {
    @apply border-l-4 border-gray-300 pl-3 italic text-gray-600 my-2;
  }

  /* Tool Card Styles (Vertical Accordion) */
  .tool-card {
    @apply overflow-hidden transition-all duration-200;
  }
  .tool-card-collapsed {
    @apply h-auto;
  }
  .tool-card-expanded {
    @apply h-auto;
  }
  .tool-header {
    @apply w-full p-4 flex flex-row items-center gap-3 hover:bg-gray-100 transition-colors cursor-pointer border-none text-left text-text;
  }
  .tool-header-static {
    @apply w-full flex flex-row items-center gap-3 text-text;
  }
  .tool-content {
    @apply pt-2 pl-10 pr-4;
  }
  .test-button {
    @apply w-full bg-button text-white px-4 py-2 rounded-xl text-xs font-medium transition-colors;
  }
  .test-link-button {
    @apply ml-auto text-button hover:text-button-hover text-xs font-medium transition-colors bg-transparent hover:bg-transparent border-none cursor-pointer underline p-0;
  }
`;

