export default function sitemap() {
  const base = "https://workbridge-preview.vercel.app";
  return [
    { url: base, lastModified: new Date() },
    { url: `${base}/matches`, lastModified: new Date() },
    { url: `${base}/applications`, lastModified: new Date() },
    { url: `${base}/employer`, lastModified: new Date() },
    { url: `${base}/profile`, lastModified: new Date() },
    { url: `${base}/login`, lastModified: new Date() },
    { url: `${base}/signup`, lastModified: new Date() },
  ];
}
