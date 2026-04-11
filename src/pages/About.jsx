import React from 'react';
import { useTranslation } from 'react-i18next';

const About = () => {
    const { t } = useTranslation();

    return (
        <div className="scav-container">
            <h1 className="scav-header">{t('aboutPage.title')}</h1>
            
            <div className="scav-box" style={{ lineHeight: '1.6', fontSize: '15px', marginBottom: '20px' }}>
                <p style={{ color: '#f0c042', fontSize: '18px', fontWeight: 'bold' }}>{t('aboutPage.p1')}</p>
                <p>{t('aboutPage.p2')}</p>
                <p>{t('aboutPage.p3')}</p>
            </div>

            {/* --- HATA BİLDİRİMİ VE İLETİŞİM ALANI --- */}
            <div className="scav-box" style={{ lineHeight: '1.6', fontSize: '15px' }}>
                <h3 style={{ 
                    color: '#f0c042', 
                    fontSize: '18px', 
                    marginTop: '0',
                    borderBottom: '1px dashed #814c11', 
                    paddingBottom: '8px', 
                    marginBottom: '15px' 
                }}>
                    {t('aboutPage.contactTitle', { defaultValue: 'Hata Bildirimi & İletişim' })}
                </h3>
                
                <p style={{ marginBottom: '20px' }}>
                    {t('aboutPage.contactDesc', { defaultValue: 'Sitemizde karşılaştığınız hataları, eksikleri veya geliştirme önerilerinizi bana doğrudan e-posta yoluyla iletebilirsiniz.' })}
                </p>
                
                {/* Buton ve E-posta Metnini Yan Yana Tutan Konteyner */}
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '15px',
                    flexWrap: 'wrap' /* Mobil ekranlarda alt alta geçmesi için */
                }}>
                    <a 
                        /* TwCobre@protonmail.com adresine "TwCobre Hata Bildirimi" konulu mail açar */
                        href="mailto:TwCobre@protonmail.com?subject=TwCobre%20Hata%20Bildirimi" 
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'linear-gradient(to bottom, #d9b972 0%, #c19c4d 100%)',
                            color: '#311800',
                            border: '1px solid #814c11',
                            padding: '10px 20px',
                            borderRadius: '6px',
                            fontWeight: '800',
                            textDecoration: 'none',
                            fontSize: '14px',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(to bottom, #e3d5b3 0%, #d9b972 100%)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(to bottom, #d9b972 0%, #c19c4d 100%)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        ✉️ {t('aboutPage.emailButton', { defaultValue: 'E-Posta Gönder' })}
                    </a>

                    {/* Kopyalanabilir E-posta Adresi */}
                    <span style={{
                        color: '#d9b972',
                        fontWeight: 'bold',
                        fontSize: '15px',
                        userSelect: 'all', /* Üzerine tıklandığında veya sürüklendiğinde tamamının kolayca seçilmesini sağlar */
                        cursor: 'text'
                    }}>
                        E-Mail: TwCobre@protonmail.com
                    </span>
                </div>
            </div>
        </div>
    );
};

export default About;