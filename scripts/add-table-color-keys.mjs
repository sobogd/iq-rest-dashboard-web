// One-off: add dashboard.tables.color* keys to every locale. Translations
// are hand-authored per locale.
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, join } from "path";

// Order: colorLabel, colorTip, colorClear, colorCustom
const TRANSLATIONS = {
  ar: ["لون الطاولة", "اختر لونًا ليتم عرضه على لوحة المخطط في لوحة التحكم بدلاً من الصورة. لن يراه ضيوف القائمة العامة.", "مسح اللون", "مخصص"],
  bg: ["Цвят на масата", "Изберете цвят, който ще се показва върху таблото на дашборда вместо снимката. Гостите на публичното меню не го виждат.", "Премахни цвета", "По избор"],
  ca: ["Color de la taula", "Tria un color que es mostrarà al plànol del tauler en lloc de la foto. Els clients del menú públic no el veuen.", "Treu el color", "Personalitzat"],
  cs: ["Barva stolu", "Vyberte barvu, která se zobrazí na plánu v dashboardu místo fotky. Hosté veřejného menu ji neuvidí.", "Odstranit barvu", "Vlastní"],
  da: ["Bordfarve", "Vælg en farve, der vises på gulvplanen i dashboardet i stedet for billedet. Gæster på den offentlige menu ser den ikke.", "Fjern farve", "Tilpasset"],
  de: ["Tischfarbe", "Wähle eine Farbe, die im Dashboard-Lageplan anstelle des Fotos angezeigt wird. Gäste der öffentlichen Speisekarte sehen sie nicht.", "Farbe entfernen", "Eigene"],
  el: ["Χρώμα τραπεζιού", "Επίλεξε ένα χρώμα που θα εμφανίζεται στον χάρτη του dashboard αντί για τη φωτογραφία. Δεν φαίνεται στους πελάτες του δημόσιου μενού.", "Καθαρισμός χρώματος", "Προσαρμοσμένο"],
  en: ["Table color", "Pick a color shown on the dashboard floor map instead of the photo. Public menu guests don't see it.", "Clear color", "Custom"],
  es: ["Color de la mesa", "Elige un color que se mostrará en el plano del panel en lugar de la foto. Los clientes del menú público no lo ven.", "Quitar color", "Personalizado"],
  et: ["Laua värv", "Vali värv, mida kuvatakse armatuurlaua põrandaplaanil foto asemel. Avaliku menüü külalised seda ei näe.", "Eemalda värv", "Kohandatud"],
  fa: ["رنگ میز", "رنگی را انتخاب کنید که در نقشه‌ی کف داشبورد به جای عکس نمایش داده شود. مهمانان منوی عمومی آن را نمی‌بینند.", "حذف رنگ", "سفارشی"],
  fi: ["Pöydän väri", "Valitse väri, joka näytetään hallintapaneelin pohjapiirroksessa kuvan sijaan. Julkisen menun asiakkaat eivät näe sitä.", "Poista väri", "Mukautettu"],
  fr: ["Couleur de la table", "Choisis une couleur affichée sur le plan du tableau de bord à la place de la photo. Les clients du menu public ne la voient pas.", "Effacer la couleur", "Personnalisé"],
  ga: ["Dath an bhoird", "Roghnaigh dath a thaispeánfar ar léarscáil urláir an deais in ionad an ghrianghraif. Ní fheicfidh aíonna an roghchláir phoiblí é.", "Glan an dath", "Saincheaptha"],
  hr: ["Boja stola", "Odaberi boju koja će se prikazivati na planu nadzorne ploče umjesto fotografije. Gosti javnog jelovnika je ne vide.", "Ukloni boju", "Prilagođeno"],
  hu: ["Asztal színe", "Válassz egy színt, amely az irányítópult alaprajzán a fotó helyett jelenik meg. A nyilvános menü vendégei nem látják.", "Szín törlése", "Egyéni"],
  is: ["Borðlitur", "Veldu lit sem birtist á gólfmynd stjórnborðsins í stað myndarinnar. Gestir opinberu matseðilsins sjá hann ekki.", "Hreinsa lit", "Sérsniðinn"],
  it: ["Colore del tavolo", "Scegli un colore mostrato sulla planimetria della dashboard al posto della foto. I clienti del menu pubblico non lo vedono.", "Rimuovi colore", "Personalizzato"],
  ja: ["テーブルの色", "ダッシュボードのフロアマップで写真の代わりに表示される色を選びます。公開メニューのお客様には表示されません。", "色をクリア", "カスタム"],
  ko: ["테이블 색상", "사진 대신 대시보드 평면도에 표시할 색상을 선택하세요. 공개 메뉴 손님에게는 표시되지 않습니다.", "색상 지우기", "사용자 지정"],
  lt: ["Stalo spalva", "Pasirink spalvą, kuri bus rodoma valdymo skydelio plane vietoj nuotraukos. Viešo meniu lankytojai jos nemato.", "Pašalinti spalvą", "Pasirinktinė"],
  lv: ["Galda krāsa", "Izvēlies krāsu, kas tiks rādīta vadības paneļa plānā fotoattēla vietā. Publiskās ēdienkartes viesi to neredz.", "Notīrīt krāsu", "Pielāgota"],
  nl: ["Tafelkleur", "Kies een kleur die op de plattegrond in het dashboard wordt getoond in plaats van de foto. Gasten van het openbare menu zien hem niet.", "Kleur wissen", "Aangepast"],
  no: ["Bordfarge", "Velg en farge som vises på dashbordets plantegning i stedet for bildet. Gjester på den offentlige menyen ser den ikke.", "Fjern farge", "Tilpasset"],
  pl: ["Kolor stolika", "Wybierz kolor wyświetlany na planie w panelu zamiast zdjęcia. Goście menu publicznego go nie widzą.", "Wyczyść kolor", "Niestandardowy"],
  pt: ["Cor da mesa", "Escolhe uma cor mostrada na planta do painel em vez da foto. Os clientes do menu público não a veem.", "Limpar cor", "Personalizado"],
  ro: ["Culoarea mesei", "Alege o culoare afișată pe planul panoului în locul fotografiei. Clienții meniului public nu o văd.", "Șterge culoarea", "Personalizat"],
  ru: ["Цвет столика", "Выберите цвет, который будет показан на схеме в дашборде вместо фото. Гости публичного меню его не видят.", "Убрать цвет", "Свой"],
  sk: ["Farba stola", "Vyber farbu, ktorá sa zobrazí na pôdoryse v dashboarde namiesto fotky. Hostia verejného menu ju nevidia.", "Odstrániť farbu", "Vlastná"],
  sl: ["Barva mize", "Izberi barvo, ki se prikaže na tlorisu nadzorne plošče namesto fotografije. Gostje javnega menija je ne vidijo.", "Odstrani barvo", "Po meri"],
  sr: ["Боја стола", "Изабери боју која ће се приказивати на плану табле уместо фотографије. Гости јавног менија је не виде.", "Уклони боју", "Прилагођено"],
  sv: ["Bordsfärg", "Välj en färg som visas på dashboardens planritning i stället för bilden. Gäster i den offentliga menyn ser den inte.", "Ta bort färg", "Anpassad"],
  tr: ["Masa rengi", "Panel zemin haritasında fotoğraf yerine gösterilecek bir renk seçin. Genel menü misafirleri bunu görmez.", "Rengi temizle", "Özel"],
  uk: ["Колір столика", "Виберіть колір, який буде показано на плані в дашборді замість фото. Гості публічного меню його не бачать.", "Очистити колір", "Власний"],
  zh: ["桌子颜色", "选择一个在仪表盘平面图上代替照片显示的颜色。公开菜单的客户看不到它。", "清除颜色", "自定义"],
};

const dir = resolve(import.meta.dirname, "..", "src", "locales");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
let touched = 0;
for (const f of files) {
  const code = f.replace(/\.json$/, "");
  const t = TRANSLATIONS[code];
  if (!t) {
    console.log(`skip ${code} — no translation`);
    continue;
  }
  const path = join(dir, f);
  const data = JSON.parse(readFileSync(path, "utf8"));
  const tables = data?.dashboard?.tables;
  if (!tables || typeof tables !== "object") {
    console.log(`skip ${code} — no dashboard.tables`);
    continue;
  }
  if (tables.colorLabel && tables.colorTip && tables.colorClear && tables.colorCustom) {
    console.log(`skip ${code} — keys already present`);
    continue;
  }
  tables.colorLabel = t[0];
  tables.colorTip = t[1];
  tables.colorClear = t[2];
  tables.colorCustom = t[3];
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  touched++;
  console.log(`patched ${code}`);
}
console.log(`\nTotal: ${touched} files`);
