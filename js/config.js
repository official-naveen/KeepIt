/**
 * KeepIt Website - Configuration File
 * Contains Supabase Project credentials and Lemon Squeezy product settings
 */

window.SUPABASE_CONFIG = {
  url: "https://srcrhiirseqodxcbikph.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyY3JoaWlyc2Vxb2R4Y2Jpa3BoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1NzkxMDIsImV4cCI6MjEwMTE1NTEwMn0.JY6J50hfVo6kbQWoKLhNqgLka1Aga1G1J4Vn2eNizpw"
};

window.LEMONSQUEEZY_CONFIG = {
  storeId: "475355",
  variantMonthlyId: "2132966",
  variantYearlyId: "2133034"
};

window.GOOGLE_CONFIG = {
  clientId: "691126141184-eo00pmvf5bbp7q5pnc1s2hge8q3narmq.apps.googleusercontent.com"
};

// Published Chrome Web Store extension ID (NOT the dev/unpacked ID, which
// changes on every local install). Used to detect whether the extension is
// installed and to deep-link into its dashboard.
//
// PRODUCTION ID
window.KEEPIT_EXTENSION_ID = "mhldbdlepccoejdjnhogckbgijohddlg";
window.KEEPIT_CHROME_WEBSTORE_URL = "https://chromewebstore.google.com/detail/keepit/mhldbdlepccoejdjnhogckbgijohddlg";
