/**
 * Everything that names this event in one place. Each copy of the app (a party, a wedding) only changes
 * src/brand/ (this file, brand.css and the scene art) and its .env; every other file under src/ is the same
 * in all copies (see docs/nucleo-comum.md). The event's dates and place still come from the organizer panel.
 */
export const BRAND = {
  /** Full name, shown in titles and the install screen */
  name: 'Confra da Firma',
  /** The name inside a sentence ("Coloca ___ na sua tela inicial", "abra ___ pelo ícone") */
  installName: 'a Confra da Firma',
  /** Short name under the home-screen icon */
  shortName: 'Confra',
  /** Wordmark: a small top line over a bigger main line */
  wordmarkTop: 'Confra',
  wordmarkMain: 'da Firma',
  /** Monogram image in public/ shown over the wordmark on the big screens; empty for none */
  monogram: '',
  /** Line under the wordmark (the couple, the team) on the opening and countdown screens */
  subtitle: 'Equipe Derhu',
  /** Line under the wordmark on the name screen */
  welcomeSub: 'Equipe Derhu · 07/11',
  /** Question on the opening screen */
  question: 'Preparado para a confraternização?',
  /** Date on the opening screen and on shared stories */
  dateLabel: '07/11',
  shortDate: '07/11',
  /** Button on the opening screen */
  enter: 'Bora!',
  /** Placeholder of the name field */
  namePlaceholder: 'Ex.: João Silva',
  /** Where the face data is used, inside "Seu rosto só é usado ___ e é apagado depois da festa." */
  faceScope: 'aqui na confra',
  /** What the outfit wall is called */
  lookName: 'Look da Confra',
  /** Empty outfit wall before the party day */
  lookSoon: 'O Look da Confra abre no dia da festa, às 7h. Já vai separando a roupa!',
  /** Prefix for files people download */
  slug: 'confra26',
  /** File name of the QR code the organizer downloads */
  qrFile: 'qr-confra-da-firma.png',
  /** goes before the personal invitation link sent on WhatsApp */
  inviteMessage: 'Seu convite pro app de fotos da Confra. Abre no celular no dia:',
  /** One line for the app manifest */
  description: 'As fotos da confraternização de fim de ano 2026',
  /** Colors drawn outside CSS (QR codes, shared stories, the shutter's lens); match brand.css */
  colors: {
    gold: '#d9a52b',
    goldHi: '#f6d77c',
    goldDeep: '#a5770f',
    ink: '#1d1a16',
    inkWarm: '#2a241c',
    paper: '#fbf3d9',
    paper2: '#f6e8bd',
    foilHi: '#fbe7a4',
  },
  /** Public project address and publishable key of this event's Supabase: safe in the browser */
  supabaseUrl: 'https://optapzbhyhklcirdoyid.supabase.co',
  supabaseKey: 'sb_publishable_9PN8BMaKHBKkCdmIylVa-w_ajGUMRv3',
} as const

/**
 * localStorage key for this event, so two copies of the app on the same phone never mix. The Confra shipped
 * before this helper existed: these are the exact keys phones already hold, so nobody loses their login.
 */
export const storageKey = (name: string) => `${name === 'darkhint' || name === 'agora' ? 'confra' : 'confra26'}.${name}`
