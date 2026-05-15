// One-off: insert dashboard.orders.{disabledTitle,disabledBody,disabledCta}
// into every locale JSON. Translations are hand-authored per locale.
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, join } from "path";

const TRANSLATIONS = {
  ar: ["الطلبات معطلة", "قم بتفعيل الطلبات في الإعدادات لتبدأ في استلامها.", "اذهب إلى الإعدادات"],
  bg: ["Поръчките са изключени", "Включете поръчките в настройките, за да започнете да ги получавате.", "Към настройките"],
  ca: ["Les comandes estan desactivades", "Activa les comandes a la configuració per començar a rebre-les.", "Vés a la configuració"],
  cs: ["Objednávky jsou vypnuté", "Zapněte objednávky v nastavení, abyste je začali přijímat.", "Přejít do nastavení"],
  da: ["Ordrer er deaktiveret", "Aktivér ordrer i indstillinger for at begynde at modtage dem.", "Gå til indstillinger"],
  de: ["Bestellungen sind deaktiviert", "Aktiviere Bestellungen in den Einstellungen, um sie zu empfangen.", "Zu den Einstellungen"],
  el: ["Οι παραγγελίες είναι απενεργοποιημένες", "Ενεργοποιήστε τις παραγγελίες στις ρυθμίσεις για να αρχίσετε να τις λαμβάνετε.", "Πήγαινε στις ρυθμίσεις"],
  en: ["Orders are disabled", "Enable orders in settings to start receiving them.", "Go to settings"],
  es: ["Los pedidos están desactivados", "Activa los pedidos en la configuración para empezar a recibirlos.", "Ir a la configuración"],
  et: ["Tellimused on välja lülitatud", "Lülitage tellimused seadetes sisse, et hakata neid vastu võtma.", "Mine seadetesse"],
  fa: ["سفارش‌ها غیرفعال هستند", "برای دریافت سفارش‌ها، آن‌ها را در تنظیمات فعال کنید.", "رفتن به تنظیمات"],
  fi: ["Tilaukset on poistettu käytöstä", "Ota tilaukset käyttöön asetuksissa aloittaaksesi niiden vastaanottamisen.", "Siirry asetuksiin"],
  fr: ["Les commandes sont désactivées", "Activez les commandes dans les paramètres pour commencer à les recevoir.", "Aller aux paramètres"],
  ga: ["Tá orduithe díchumasaithe", "Cumasaigh orduithe sna socruithe chun tús a chur leo a fháil.", "Téigh chuig na socruithe"],
  hr: ["Narudžbe su onemogućene", "Omogući narudžbe u postavkama da ih počneš primati.", "Idi u postavke"],
  hu: ["A rendelések le vannak tiltva", "Engedélyezd a rendeléseket a beállításokban, hogy fogadhasd őket.", "Ugrás a beállításokra"],
  is: ["Pantanir eru óvirkar", "Virkjaðu pantanir í stillingum til að byrja að taka við þeim.", "Fara í stillingar"],
  it: ["Gli ordini sono disattivati", "Attiva gli ordini nelle impostazioni per iniziare a riceverli.", "Vai alle impostazioni"],
  ja: ["注文は無効です", "注文を受け付けるには、設定で有効にしてください。", "設定を開く"],
  ko: ["주문이 비활성화되어 있습니다", "주문을 받으려면 설정에서 활성화하세요.", "설정으로 이동"],
  lt: ["Užsakymai išjungti", "Įjunkite užsakymus nustatymuose, kad pradėtumėte juos gauti.", "Eiti į nustatymus"],
  lv: ["Pasūtījumi ir izslēgti", "Iespējojiet pasūtījumus iestatījumos, lai sāktu tos saņemt.", "Doties uz iestatījumiem"],
  nl: ["Bestellingen zijn uitgeschakeld", "Schakel bestellingen in via instellingen om ze te ontvangen.", "Naar instellingen"],
  no: ["Bestillinger er deaktivert", "Aktiver bestillinger i innstillinger for å begynne å motta dem.", "Gå til innstillinger"],
  pl: ["Zamówienia są wyłączone", "Włącz zamówienia w ustawieniach, aby zacząć je przyjmować.", "Przejdź do ustawień"],
  pt: ["Os pedidos estão desativados", "Ative os pedidos nas configurações para começar a recebê-los.", "Ir para as configurações"],
  ro: ["Comenzile sunt dezactivate", "Activează comenzile în setări pentru a începe să le primești.", "Mergi la setări"],
  ru: ["Заказы отключены", "Включите заказы в настройках, чтобы начать их принимать.", "Перейти в настройки"],
  sk: ["Objednávky sú vypnuté", "Zapnite objednávky v nastaveniach, aby ste ich začali prijímať.", "Prejsť do nastavení"],
  sl: ["Naročila so onemogočena", "Omogočite naročila v nastavitvah, da jih začnete prejemati.", "Pojdi v nastavitve"],
  sr: ["Поруџбине су онемогућене", "Омогућите поруџбине у подешавањима да бисте почели да их примате.", "Иди у подешавања"],
  sv: ["Beställningar är inaktiverade", "Aktivera beställningar i inställningar för att börja ta emot dem.", "Gå till inställningar"],
  tr: ["Siparişler kapalı", "Sipariş almak için ayarlardan siparişleri etkinleştirin.", "Ayarlara git"],
  uk: ["Замовлення вимкнено", "Увімкніть замовлення в налаштуваннях, щоб почати їх отримувати.", "Перейти до налаштувань"],
  zh: ["订单已禁用", "在设置中启用订单以开始接收订单。", "前往设置"],
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
  const orders = data?.dashboard?.orders;
  if (!orders || typeof orders !== "object") {
    console.log(`skip ${code} — no dashboard.orders`);
    continue;
  }
  if (orders.disabledTitle && orders.disabledBody && orders.disabledCta) {
    console.log(`skip ${code} — keys already present`);
    continue;
  }
  orders.disabledTitle = t[0];
  orders.disabledBody = t[1];
  orders.disabledCta = t[2];
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  touched++;
  console.log(`patched ${code}`);
}
console.log(`\nTotal: ${touched} files`);
