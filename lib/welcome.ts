export type WelcomeProfile = {
  name: string;
  tone: "sunshine" | "asshole" | "unc";
};

const affectionateGreetingWords = [
  "cutie",
  "beautiful",
  "beauty",
  "sexy",
  "gorgeous",
  "lovely",
  "sunshine",
] as const;

const playfulRoastGreetings = [
  "Hey, asshole",
  "Hey, dumbass",
  "Morning, menace",
  "Hey, gremlin",
  "What’s up, clown",
  "Hey, disaster",
  "Morning, troublemaker",
  "Look who’s awake",
  "Hey, unc",
  "Morning, fossil",
  "Hey, old man",
  "What’s up, dinosaur",
  "Hey, grandpa",
  "Morning, ancient one",
  "Hey, relic",
  "Look who survived another day",
] as const;

export function getTimeGreeting(hour: number) {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Good night";
}

export function getPersonalGreeting(hour: number, profile: WelcomeProfile | null) {
  const timeGreeting = getTimeGreeting(hour);
  if (!profile) return timeGreeting;
  if (profile.tone === "sunshine") {
    const greetingOptions = [
      `Hey, ${timeGreeting.toLowerCase()} sunshine, ${profile.name}`,
      ...affectionateGreetingWords.map((word) => `Hey, ${word}, ${profile.name}`),
    ];
    const nameOffset = profile.name.codePointAt(0) ?? 0;
    return greetingOptions[(hour + nameOffset) % greetingOptions.length];
  }
  const nameOffset = profile.name.codePointAt(0) ?? 0;
  return playfulRoastGreetings[(hour + nameOffset) % playfulRoastGreetings.length];
}
