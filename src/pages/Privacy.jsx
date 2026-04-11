import React from 'react';
import { useTranslation } from 'react-i18next';

const Privacy = () => {
    const { t } = useTranslation();

    return (
        <div className="scav-container">
            <h1 className="scav-header">{t('privacyPage.title')}</h1>
            <div className="scav-box" style={{ lineHeight: '1.6', fontSize: '14px' }}>
                <p>{t('privacyPage.p1')}</p>
                <ul style={{ color: '#eaddbd', background: '#111', padding: '20px 40px', borderRadius: '6px', border: '1px solid #444' }}>
                    <li style={{ marginBottom: '10px' }}>{t('privacyPage.items.i1')}</li>
                    <li style={{ marginBottom: '10px' }}>{t('privacyPage.items.i2')}</li>
                    <li style={{ marginBottom: '10px' }}>{t('privacyPage.items.i3')}</li>
                    <li>{t('privacyPage.items.i4')}</li>
                </ul>
                <p style={{ color: '#5cb85c', fontWeight: 'bold', marginTop: '15px' }}>{t('privacyPage.p2')}</p>
            </div>
        </div>
    );
};

export default Privacy;