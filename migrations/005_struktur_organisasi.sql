ALTER TABLE app_state DROP CONSTRAINT app_state_key_check;
ALTER TABLE app_state
  ADD CONSTRAINT app_state_key_check
  CHECK (key IN ('berita', 'komentar', 'site-settings', 'dokumentasi', 'struktur'));

ALTER TABLE app_state DROP CONSTRAINT app_state_value_shape;
ALTER TABLE app_state
  ADD CONSTRAINT app_state_value_shape
  CHECK (
    (key = 'berita' AND jsonb_typeof(value) = 'array')
    OR (
      key = 'komentar'
      AND jsonb_typeof(value) = 'object'
      AND COALESCE(jsonb_typeof(value -> 'comments') = 'array', FALSE)
      AND COALESCE(jsonb_typeof(value -> 'reactions') = 'array', FALSE)
      AND COALESCE(jsonb_typeof(value -> 'reports') = 'array', FALSE)
    )
    OR (key = 'site-settings' AND jsonb_typeof(value) = 'object')
    OR (key = 'dokumentasi' AND jsonb_typeof(value) = 'array')
    OR (
      key = 'struktur'
      AND jsonb_typeof(value) = 'object'
      AND COALESCE(jsonb_typeof(value -> 'sections') = 'array', FALSE)
      AND COALESCE(jsonb_typeof(value -> 'members') = 'array', FALSE)
    )
  );

INSERT INTO app_state (key, value)
VALUES (
  'struktur',
  $structure$
  {
    "sections": [
      {"id":"pimpinan","title":"Pimpinan","description":"Pimpinan Badan Kesatuan Bangsa dan Politik Kabupaten Ponorogo."},
      {"id":"sekretariat","title":"Sekretariat","description":"Administrasi umum, kepegawaian, keuangan, perencanaan, dan pelaporan."},
      {"id":"ideologi","title":"Ideologi, Wawasan Kebangsaan dan Ketahanan Ekonomi, Sosial, Budaya, Agama","description":"Pembinaan ideologi Pancasila, wawasan kebangsaan, dan ketahanan sosial budaya."},
      {"id":"politik","title":"Politik Dalam Negeri dan Organisasi Kemasyarakatan","description":"Fasilitasi kehidupan demokrasi dan pembinaan organisasi kemasyarakatan."},
      {"id":"kewaspadaan","title":"Kewaspadaan Nasional dan Penanganan Konflik","description":"Kewaspadaan nasional, deteksi dini, dan penanganan konflik sosial."}
    ],
    "members": [
      {"id":"kepala-badan","sectionId":"pimpinan","name":"Dra. Besse Tenrisampeang, M.Si.","position":"Kepala Badan","photo":"","order":1},
      {"id":"sekretaris","sectionId":"sekretariat","name":"Bambang Windusancoyo, S.Sos.","position":"Sekretaris","photo":"","order":1},
      {"id":"rini-listyowati","sectionId":"sekretariat","name":"Rini Listyowati, S.H.","position":"Perencana Ahli Muda","photo":"","order":2},
      {"id":"lestari-dewi-utami","sectionId":"sekretariat","name":"Lestari Dewi Utami, S.H.","position":"Analis Keuangan Pemerintah Pusat & Daerah Ahli Muda","photo":"","order":3},
      {"id":"lilik-mariyani","sectionId":"sekretariat","name":"Lilik Mariyani, S.Sos.","position":"Penelaah Teknis Kebijakan","photo":"","order":4},
      {"id":"mailani-saadah","sectionId":"sekretariat","name":"Mailani Sa'adah, S.E.I.","position":"Arsiparis Ahli Pertama","photo":"","order":5},
      {"id":"nidia-sukmawati","sectionId":"sekretariat","name":"Nidia Sukmawati Rahardi, S.Ak.","position":"Pengolah Data dan Informasi","photo":"","order":6},
      {"id":"sumono","sectionId":"sekretariat","name":"Sumono","position":"Pengadministrasi Perkantoran","photo":"","order":7},
      {"id":"sumarni","sectionId":"sekretariat","name":"Sumarni","position":"Pengadministrasi Perkantoran","photo":"","order":8},
      {"id":"dadang-praminto","sectionId":"sekretariat","name":"Dadang Praminto","position":"Pengadministrasi Perkantoran","photo":"","order":9},
      {"id":"suparman","sectionId":"sekretariat","name":"Suparman","position":"Pengadministrasi Perkantoran","photo":"","order":10},
      {"id":"suyatno","sectionId":"sekretariat","name":"Suyatno","position":"Pengadministrasi Perkantoran","photo":"","order":11},
      {"id":"sarwono","sectionId":"sekretariat","name":"Sarwono","position":"Operator Layanan Operasional","photo":"","order":12},
      {"id":"affan-abror-ubaidillah","sectionId":"sekretariat","name":"Affan Abror Ubaidillah","position":"Operator Layanan Operasional","photo":"","order":13},
      {"id":"jajak-aris-pambudi","sectionId":"politik","name":"Jajak Aris Pambudi, S.STP., M.Si.","position":"Kepala Bidang","photo":"","order":1},
      {"id":"suswaningsih","sectionId":"politik","name":"Suswaningsih, S.Sos., M.Si.","position":"Analis Kebijakan Ahli Muda","photo":"","order":2},
      {"id":"endi-budijanto","sectionId":"politik","name":"Endi Budijanto, S.Sos.","position":"Analis Kebijakan Ahli Muda","photo":"","order":3},
      {"id":"ermadi-soeryantoro","sectionId":"politik","name":"Ermadi Soeryantoro, S.Sos.","position":"Penelaah Teknis Kebijakan","photo":"","order":4},
      {"id":"wildana-al-faruqi","sectionId":"politik","name":"Wildana Al Faruqi, S.IAN.","position":"Penelaah Teknis Kebijakan","photo":"","order":5},
      {"id":"imam-wiyono","sectionId":"politik","name":"Imam Wiyono, S.Pd.","position":"Pengadministrasi Perkantoran","photo":"","order":6},
      {"id":"wimphi-christianto","sectionId":"kewaspadaan","name":"Wimphi Christianto, S.STP.","position":"Kepala Bidang","photo":"","order":1},
      {"id":"anies-triana","sectionId":"kewaspadaan","name":"Anies Triana, S.Sos., M.Si.","position":"Analis Kebijakan Ahli Muda","photo":"","order":2},
      {"id":"heru-gatut-saputro","sectionId":"kewaspadaan","name":"Heru Gatut Saputro","position":"Pengadministrasi Perkantoran","photo":"","order":3},
      {"id":"sunarti","sectionId":"kewaspadaan","name":"Sunarti","position":"Pengolah Data dan Informasi","photo":"","order":4},
      {"id":"aditya-khoirul-anam","sectionId":"kewaspadaan","name":"Aditya Khoirul Anam, A.Md.","position":"Pranata Komputer Terampil","photo":"","order":5},
      {"id":"bambang-hermawan","sectionId":"ideologi","name":"Bambang Hermawan, S.E.","position":"Kepala Bidang","photo":"","order":1},
      {"id":"rizqi-azhar-irwansyah","sectionId":"ideologi","name":"Rizqi Azhar Irwansyah, S.E., M.M.","position":"Analis Kebijakan Ahli Muda","photo":"","order":2},
      {"id":"angga-chrisdana","sectionId":"ideologi","name":"Angga Chrisdana, S.Sos.","position":"Penelaah Teknis Kebijakan","photo":"","order":3},
      {"id":"rudi-kristanto","sectionId":"ideologi","name":"Rudi Kristanto","position":"Pengadministrasi Perkantoran","photo":"","order":4},
      {"id":"sepvina-dwi-santoso","sectionId":"ideologi","name":"Sepvina Dwi Santoso, A.Md.Kom.","position":"Pranata Komputer Terampil","photo":"","order":5}
    ]
  }
  $structure$::jsonb
)
ON CONFLICT (key) DO NOTHING;
