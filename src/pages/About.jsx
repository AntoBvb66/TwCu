import React from 'react';
import { useTranslation } from 'react-i18next';
import './StaticPage.css';

const CONTACT_MAIL = 'TwCobre@protonmail.com';

const About = () => {
    const { t } = useTranslation();

    return (
        <div className="static-page">
            <h1 className="static-page-header">{t('aboutPage.title')}</h1>

            <section className="static-card">
                <p className="static-lead">{t('aboutPage.p1')}</p>
                <p>{t('aboutPage.p2')}</p>
                <p>{t('aboutPage.p3')}</p>
            </section>

            {/* --- HATA BİLDİRİMİ VE İLETİŞİM --- */}
            <section className="static-card">
                <h2>{t('aboutPage.contactTitle')}</h2>
                <p>{t('aboutPage.contactDesc')}</p>

                <div className="static-contact">
                    <a
                        className="static-mail-btn"
                        href={`mailto:${CONTACT_MAIL}?subject=TwCobre%20Hata%20Bildirimi`}
                    >
                        <span aria-hidden="true">✉️</span>
                        {t('aboutPage.emailButton')}
                    </a>

                    {/* Tek tıkla tamamı seçilebilsin diye user-select: all */}
                    <span className="static-mail-address">{CONTACT_MAIL}</span>
                </div>
            </section>
        </div>
    );
};

export default About;
