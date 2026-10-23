/**
 * The screenprint inks, after the mood board's Vocabulary board: paper and night paper, key ink and bone, three
 * plates (oxide, ice, dust) and the amber accent. Habitat green and crystal violet are the two objectives'
 * own spot colours, as their tiles have them (regolith/base.ts).
 */
export const INKS = {
  paper: '#E6DDC8',
  night: '#23211F',
  key: '#1E1C1A',
  bone: '#EDE6D6',
  oxide: '#E0703A',
  ice: '#A9C9D3',
  amber: '#F2B233',
  /** Mars's dust, the mood board's "Jupiter". */
  dust: '#D9A066',
  /** Its darker bands. */
  rust: '#B9774A',
  /** Phobos's grey ground. */
  grey: '#8E8880',
  green: '#7FB08A',
  violet: '#9C86C9',
} as const;

/** How a mech is printed: its key ink, seams, joints, recesses, rods, lights, the rifle's metal, and its side face in three-quarter view. */
export interface MechInk {
  key: string;
  seam: string;
  joint: string;
  recess: string;
  rod: string;
  light: string;
  gun: string;
  side: string;
}

/** On paper (the permanent deck): key ink, as the Silhouettes board prints it. */
export const ON_PAPER: MechInk = {
  key: INKS.key,
  seam: '#5C544D',
  joint: '#4A4440',
  recess: '#3A3532',
  rod: '#5A534D',
  light: INKS.paper,
  gun: '#6E6760',
  side: '#4A4440',
};

/** On night paper (the one-shot decks): bone. */
export const ON_NIGHT: MechInk = {
  key: INKS.bone,
  seam: '#A79F92',
  joint: '#C9C0B1',
  recess: '#D6CEC0',
  rod: '#A79F92',
  light: INKS.night,
  gun: '#B5AC9E',
  side: '#BDB4A5',
};

/** The far side's limbs in three-quarter view: a step back towards the paper. */
export const farInk = (ink: MechInk, paper: string): MechInk => ({
  ...ink,
  key: paper === INKS.night ? '#8F877B' : '#4A4440',
  seam: paper === INKS.night ? '#6F685E' : '#5C544D',
  joint: paper === INKS.night ? '#7D766B' : '#5A534D',
  recess: paper === INKS.night ? '#7D766B' : '#5A534D',
  light: paper === INKS.night ? '#8F877B' : '#4A4440',
});

/** One ink for every part: a colour plate's print of the shape. */
export const mono = (colour: string): MechInk => ({
  key: colour,
  seam: colour,
  joint: colour,
  recess: colour,
  rod: colour,
  light: colour,
  gun: colour,
  side: colour,
});
