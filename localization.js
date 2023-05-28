// localization.js

const translations = {
    en: {
        settingsTitle: "YouTube subtitles-to-speech settings",
        speedLabel: "Speed:",
        volumeLabel: "Volume:",
        voiceLabel: "Voice:",
        learnMoreText: '<a href="https://support.microsoft.com/en-gb/topic/download-languages-and-voices-for-immersive-reader-read-mode-and-read-aloud-4c83a8d8-7486-42f7-8e46-2b0fdf753130">Click to learn how to add more voices<br></a>',
        selectLanguageText: 'Select a language with <i>"text-to-speech"</i> &#8594; <br>tick <i>"Speech (xx MB)"</i> &#8594; install &#8594; restart the PC ',
    },
    fallback: {
        settingsTitle: "YouTube subtitles-to-speech settings",
        speedLabel: "Speed:",
        volumeLabel: "Volume:",
        voiceLabel: "Voice:",
        learnMoreText: '<a href="https://support.microsoft.com/en-gb/topic/download-languages-and-voices-for-immersive-reader-read-mode-and-read-aloud-4c83a8d8-7486-42f7-8e46-2b0fdf753130">Click to learn how to add more voices<br></a>',
        selectLanguageText: 'Select a language with <i>"text-to-speech"</i> &#8594; <br>tick <i>"Speech (xx MB)"</i> &#8594; install &#8594; restart the PC<br>Your language has no text to speech icon next to it? &#8594; download the Chrome browser extension (under the same name), which supports all voices available in Google Translate',
    },
    fr: {
        settingsTitle: "Paramètres de conversion des sous-titres YouTube en synthèse vocale",
        speedLabel: "Vitesse:",
        volumeLabel: "Volume:",
        voiceLabel: "Voix:",
        learnMoreText: '<a href="https://support.microsoft.com/fr-fr/topic/t%C3%A9l%C3%A9charger-les-langues-et-les-voix-pour-lecteur-immersif-le-mode-lecture-et-la-lecture-%C3%A0-voix-haute-4c83a8d8-7486-42f7-8e46-2b0fdf753130">Cliquez ici pour en savoir plus sur l\'ajout de voix supplémentaires<br></a> ',
        selectLanguageText: 'Sélectionnez une langue avec <i>"text-to-speech"</i> &#8594; cochez <i>"Voix (xx Mo)"</i> &#8594; installez &#8594; redémarrez l\'ordinateur',
    },
    es: {
        settingsTitle: "Configuración de subtítulos a voz en YouTube",
        speedLabel: "Velocidad:",
        volumeLabel: "Volumen:",
        voiceLabel: "Voz:",
        learnMoreText: '<a href="https://support.microsoft.com/es-es/topic/descargar-idiomas-y-voces-para-lector-inmersivo-el-modo-lectura-y-lectura-en-voz-alta-4c83a8d8-7486-42f7-8e46-2b0fdf753130">Haz clic para aprender cómo agregar más voces<br></a>',
        selectLanguageText: 'Selecciona un idioma con <i>"texto a voz"</i> &#8594; <br>marca <i>"Voz (xx MB)"</i> &#8594; instala &#8594; reinicia la PC',
    },
    zh: {
        settingsTitle: "YouTube 字幕转语音设置",
        speedLabel: "速度：",
        volumeLabel: "音量：",
        voiceLabel: "声音：",
        learnMoreText: '<a href="https://support.microsoft.com/zh-cn/topic/%E4%B8%8B%E8%BD%BD%E7%94%A8%E4%BA%8E%E6%B2%89%E6%B5%B8%E5%BC%8F%E9%98%85%E8%AF%BB%E5%99%A8-%E9%98%85%E8%AF%BB%E6%A8%A1%E5%BC%8F%E5%92%8C%E5%A4%A7%E5%A3%B0%E6%9C%97%E8%AF%BB%E7%9A%84%E8%AF%AD%E8%A8%80%E5%92%8C%E8%AF%AD%E9%9F%B3-4c83a8d8-7486-42f7-8e46-2b0fdf753130">点击了解如何添加更多语音<br></a>',
        selectLanguageText: '选择一个支持 <i>"语音合成"</i> 的语言 &#8594; <br>勾选 <i>"语音 (xx MB)"</i> &#8594; 安装 &#8594; 重启计算机',
    },
    hi: {
        settingsTitle: "YouTube उपशीर्षक-से-वाणी सेटिंग्स",
        speedLabel: "गति:",
        volumeLabel: "आवाज़:",
        voiceLabel: "आवाज़:",
        learnMoreText: '',
        selectLanguageText: 'फ़ायरफ़ॉक्स पर हिंदू के लिए टेक्स्ट से ध्वनि में बदलने की समर्थन नहीं है। कृपया च्रोम (वेब ब्राउज़र) एक्सटेंशन डाउनलोड करें, जहां हिंदू को समर्थित किया जाता है, जो एक ही नाम के तहत है।',
    },
    ar: {
        settingsTitle: "إعدادات تحويل ترجمات يوتيوب إلى كلام",
        speedLabel: "السرعة:",
        volumeLabel: "الصوت:",
        voiceLabel: "الصوت:",
        learnMoreText: '',
        selectLanguageText: 'لغة العربية غير مدعومة في متصفح فايرفوكس للتحويل من النص إلى الكلام. يُرجى تنزيل إضافة متصفح كروم، حيث تتوفر الدعم للعربية تحت نفس الاسم.',
    },
    pt: {
        settingsTitle: "Configurações de legendas para fala no YouTube",
        speedLabel: "Velocidade:",
        volumeLabel: "Volume:",
        voiceLabel: "Voz:",
        learnMoreText: '<a href="https://support.microsoft.com/pt-pt/topic/transferir-idiomas-e-vozes-para-leitura-avan%C3%A7ada-modo-de-leitura-e-ler-em-voz-alta-4c83a8d8-7486-42f7-8e46-2b0fdf753130">Clique para aprender como adicionar mais vozes<br></a>',
        selectLanguageText: 'Selecione um idioma com suporte a <i>"texto para fala"</i> &#8594; <br>marque <i>"Fala (xx MB)"</i> &#8594; instale &#8594; reinicie o PC',
    },
    pl: {
        settingsTitle: "Ustawienia napisów (mowa) w YouTube",
        speedLabel: "Prędkość:",
        volumeLabel: "Głośność:",
        voiceLabel: "Głos:",
        learnMoreText: '<a href="https://support.microsoft.com/pl-pl/topic/pobieranie-j%C4%99zyk%C3%B3w-i-g%C5%82os%C3%B3w-dla-czytnik-immersyjny-trybu-czytania-i-czytania-na-g%C5%82os-4c83a8d8-7486-42f7-8e46-2b0fdf753130">Kliknij, aby dowiedzieć się, jak dodać więcej głosów<br></a>',
        selectLanguageText: 'Wybierz język obsługujący <i>"tekst na mowę"</i> → <br>zaznacz <i>"Mowa (xx MB)"</i> → zainstaluj → uruchom ponownie komputer',
    },
    ko: {
        settingsTitle: "YouTube 자막 음성 변환 설정",
        speedLabel: "속도:",
        volumeLabel: "음량:",
        voiceLabel: "음성:",
        learnMoreText: '<a href="https://support.microsoft.com/ko-kr/topic/%EB%AA%B0%EC%9E%85%ED%98%95-%EB%A6%AC%EB%8D%94-%EC%9D%BD%EA%B8%B0-%EB%AA%A8%EB%93%9C-%EB%B0%8F-%EC%86%8C%EB%A6%AC-%EB%82%B4%EC%96%B4-%EC%9D%BD%EA%B8%B0%EC%9A%A9-%EC%96%B8%EC%96%B4-%EB%B0%8F-%EC%9D%8C%EC%84%B1-%EB%8B%A4%EC%9A%B4%EB%A1%9C%EB%93%9C-4c83a8d8-7486-42f7-8e46-2b0fdf753130">더 많은 음성 추가 방법 알아보기<br></a>',
        selectLanguageText: ' <i>"텍스트를 음성으로"</i> 지원하는 언어를 선택하세요 → <br><i>"음성 (xx MB)"</i>를 선택하세요 → 설치하세요 → 컴퓨터를 다시 시작하세요',
    },
    it: {
        settingsTitle: "Impostazioni sottotitoli in voce su YouTube",
        speedLabel: "Velocità:",
        volumeLabel: "Volume:",
        voiceLabel: "Voce:",
        learnMoreText: '<a href="https://support.microsoft.com/it-it/topic/scaricare-lingue-e-voci-per-strumento-di-lettura-immersiva-modalit%C3%A0-di-lettura-e-lettura-ad-alta-voce-4c83a8d8-7486-42f7-8e46-2b0fdf753130">Fai clic per scoprire come aggiungere altre voci<br></a>',
        selectLanguageText: 'Seleziona una lingua con supporto <i>"testo in voce"</i> → <br>spunta <i>"Voce (xx MB)"</i> → installa → riavvia il PC',
    },
    tr: {
        settingsTitle: "YouTube altyazıdan sesli okuma ayarları",
        speedLabel: "Hız:",
        volumeLabel: "Ses Düzeyi:",
        voiceLabel: "Ses:",
        learnMoreText: '',
        selectLanguageText: 'Firefox\'ta Türkçe için metinden sese dönüştürme desteklenmemektedir. Lütfen aynı adı taşıyan Chrome (web tarayıcısı) eklentisini indirin, Türkçe desteği sunmaktadır.',
    },
};

function applyTranslations() {
    const userLanguage = navigator.language.substring(0, 2); // Get the user's language preference

    const translation = translations[userLanguage] || translations.fallback; // Fallback to English if translation not available for user's language

    for (const key in translation) {
        if (translation.hasOwnProperty(key)) {
            const element = document.getElementById(key);
            if (element) {
                element.innerHTML = translation[key];
            }
        }
    }
}

document.addEventListener("DOMContentLoaded", applyTranslations);
