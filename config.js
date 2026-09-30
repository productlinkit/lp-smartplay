// All Smart Play settings live here. User-facing copy lives in i18n/my.json and i18n/en.json;
// each package and app is named there under the same id used below.
window.SP_CONFIG = {
  cancelCode: "*XXXX#",   // placeholder until ATOM assigns the real code
  defaultLang: "my",
  defaultPackage: "3day",

  // Name and access copy for each package: i18n keys "packages.<id>.name" / "packages.<id>.access".
  packages: [
    { id: "daily", price: 200, days: 1 },
    { id: "3day", price: 735, days: 3 },
  ],

  // Description copy: i18n key "apps.<id>.desc". "catalog" opens the in-portal game list instead of a url
  // (same 100 games and play links as the Smart Play portal); an app with neither shows a "link not set" note.
  apps: [
    { id: "quizpro", name: "QuizPro", icon: "assets/quizpro.webp", url: "https://mm.quizpro.mobi" },
    { id: "speakeasy", name: "SpeakEasy", icon: "assets/speakeasy.webp", url: "https://speakeasy.mobi" },
    { id: "playverse", name: "PlayVerse", icon: "assets/playverse.webp", url: "", catalog: "games.json" },
  ],

  links: { terms: "", privacy: "", help: "" },

  // Where the success popup's button sends the user. Leave empty to open the in-app portal instead.
  successUrl: "https://growthplus-weld.vercel.app",

  // Simulated ATOM round trip after "Confirm", in milliseconds.
  confirmDelayMs: 900,

  // Query parameters used by the prototype itself; they are not forwarded to the app links.
  internalParams: ["dev", "lang", "net", "sub", "result"],
};
