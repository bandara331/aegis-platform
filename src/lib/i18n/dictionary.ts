export type SupportedLocale = "en" | "si" | "ta";

export interface UiDictionary {
  brandTitle: string;
  tagline: string;
  nav: {
    home: string;
    alerts: string;
    citizenLogin: string;
    citizenRegister: string;
    staffLogin: string;
    requestHelp: string;
    myRequests: string;
    aiAssistant: string;
    profile: string;
    signOut: string;
  };
  empty: {
    noAlerts: string;
    noRequests: string;
    noQueue: string;
    noShelters: string;
    noResources: string;
    noVolunteers: string;
    noDonations: string;
    noAudit: string;
    noReports: string;
    noMessages: string;
  };
}

export const DICTIONARY: Record<SupportedLocale, UiDictionary> = {
  en: {
    brandTitle: "AEGIS Humanitarian Platform",
    tagline: "AI advises. Named humans decide. Every step is audited.",
    nav: {
      home: "Overview",
      alerts: "Public Alerts",
      citizenLogin: "Citizen Sign-In",
      citizenRegister: "Register",
      staffLogin: "Staff Portal",
      requestHelp: "Request Aid",
      myRequests: "My Cases",
      aiAssistant: "AI Assistant",
      profile: "Profile",
      signOut: "Sign Out",
    },
    empty: {
      noAlerts: "No active emergency alerts have been declared in the database.",
      noRequests: "You have not submitted any emergency assistance requests yet.",
      noQueue: "No assistance requests are currently waiting in the triage queue.",
      noShelters: "No emergency shelters are registered in the database yet.",
      noResources: "No relief resource depots or stock items exist in the database yet.",
      noVolunteers: "No registered volunteers found in the database.",
      noDonations: "No active relief campaigns or donations recorded yet.",
      noAudit: "No cryptographic audit log entries recorded yet.",
      noReports: "No post-incident analytical reports generated yet.",
      noMessages: "No messages in this thread yet.",
    },
  },
  si: {
    brandTitle: "AEGIS මානුෂීය සම්බන්ධීකරණ වේදිකාව",
    tagline: "AI උපදෙස් දෙයි. නිලධාරීන් තීරණය කරයි. සෑම පියවරක්ම විගණනය කෙරේ.",
    nav: {
      home: "මුල් පිටුව",
      alerts: "නිල නිවේදන",
      citizenLogin: "පුරවැසි පිවිසුම",
      citizenRegister: "ලියාපදිංචි වන්න",
      staffLogin: "කාර්ය මණ්ඩලය",
      requestHelp: "ආධාර ඉල්ලන්න",
      myRequests: "මගේ ඉල්ලීම්",
      aiAssistant: "AI සහායක",
      profile: "ගිණුම",
      signOut: "ඉවත් වන්න",
    },
    empty: {
      noAlerts: "දත්ත පද්ධතියේ දැනට සක්‍රිය හදිසි ආපදා නිවේදන නොමැත.",
      noRequests: "ඔබ තවමත් කිසිදු හදිසි ආධාර ඉල්ලීමක් ඉදිරිපත් කර නොමැත.",
      noQueue: "ප්‍රමුඛතා පෝලිමේ දැනට ආධාර ඉල්ලීම් නොමැත.",
      noShelters: "දත්ත පද්ධතියේ තවමත් ආරක්ෂිත මධ්‍යස්ථාන ලියාපදිංචි කර නොමැත.",
      noResources: "දත්ත පද්ධතියේ ආධාර තොග වාර්තා වී නොමැත.",
      noVolunteers: "ලියාපදිංචි ස්වේච්ඡා සේවකයන් හමු නොවීය.",
      noDonations: "ආධාර ව්‍යාපාර හෝ පරිත්‍යාග තවමත් වාර්තා වී නොමැත.",
      noAudit: "විගණන සටහන් තවමත් වාර්තා වී නොමැත.",
      noReports: "වාර්තා තවමත් උත්පාදනය කර නොමැත.",
      noMessages: "මෙම සංවාදයේ තවමත් පණිවිඩ නොමැත.",
    },
  },
  ta: {
    brandTitle: "AEGIS மனிதாபிமான ஒருங்கிணைப்பு தளம்",
    tagline: "AI பரிந்துரைக்கிறது. மனிதர்கள் முடிவெடுக்கிறார்கள். ஒவ்வொரு படியும் தணிக்கை செய்யப்படுகிறது.",
    nav: {
      home: "முகப்பு",
      alerts: "பொது எச்சரிக்கைகள்",
      citizenLogin: "குடிமக்கள் உள்நுழைவு",
      citizenRegister: "பதிவு செய்க",
      staffLogin: "பணியாளர் தளம்",
      requestHelp: "உதவி கோருக",
      myRequests: "எனது கோரிக்கைகள்",
      aiAssistant: "AI உதவியாளர்",
      profile: "சுயவிவரம்",
      signOut: "வெளியேறு",
    },
    empty: {
      noAlerts: "தற்போது தரவுத்தளத்தில் அவசர எச்சரிக்கைகள் எதுவும் இல்லை.",
      noRequests: "நீங்கள் இன்னும் எந்த அவசர உதவி கோரிக்கையையும் சமர்ப்பிக்கவில்லை.",
      noQueue: "முன்னுரிமை வரிசையில் தற்போது கோரிக்கைகள் எதுவும் இல்லை.",
      noShelters: "தரவுத்தளத்தில் பாதுகாப்பு முகாம்கள் எதுவும் பதிவு செய்யப்படவில்லை.",
      noResources: "நிவாரணப் பொருட்கள் கையிருப்பு எதுவும் பதிவு செய்யப்படவில்லை.",
      noVolunteers: "தன்னார்வலர்கள் யாரும் பதிவு செய்யப்படவில்லை.",
      noDonations: "நன்கொடைகள் எதுவும் இன்னும் பதிவு செய்யப்படவில்லை.",
      noAudit: "தணிக்கை பதிவுகள் எதுவும் இல்லை.",
      noReports: "அறிக்கைகள் எதுவும் உருவாக்கப்படவில்லை.",
      noMessages: "இன்னும் செய்திகள் எதுவும் இல்லை.",
    },
  },
};

export function getDictionary(locale?: string | null): UiDictionary {
  if (locale === "si" || locale === "ta") {
    return DICTIONARY[locale];
  }
  return DICTIONARY.en;
}
