import React from 'react';
import { useTranslation } from 'react-i18next';
import './StaticPage.css';

const Privacy = () => {
    const { t } = useTranslation();

    return (
        <div className="static-page">
            <h1 className="static-page-header">{t('privacyPage.title')}</h1>

            <section className="static-card">
                <p>{t('privacyPage.p1')}</p>

                <ul className="static-list">
                    <li>{t('privacyPage.items.i1')}</li>
                    <li>{t('privacyPage.items.i2')}</li>
                    <li>{t('privacyPage.items.i3')}</li>
                    <li>{t('privacyPage.items.i4')}</li>
                </ul>

                <p className="static-note">{t('privacyPage.p2')}</p>
            </section>
        </div>
    );
};

export default Privacy;
