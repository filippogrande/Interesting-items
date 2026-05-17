import time
from aliexpress import scrape_aliexpress

if __name__ == '__main__':
    urls = [
        # Esempi: sostituisci con i prodotti reali che vuoi testare
        "https://it.aliexpress.com/item/1005008749050132.html?spm=a2g0o.home.pcJustForYou.30.120d285e6R2dkJ&gps-id=pcJustForYou&scm=1007.32079.367808.0&scm_id=1007.32079.367808.0&scm-url=1007.32079.367808.0&pvid=5a413e02-d987-4be5-a6f5-9266b9cf7bdd&_t=gps-id:pcJustForYou,scm-url:1007.32079.367808.0,pvid:5a413e02-d987-4be5-a6f5-9266b9cf7bdd,tpp_buckets:668%232846%238110%231995&pdp_ext_f=%7B%22order%22%3A%222505%22%2C%22eval%22%3A%221%22%2C%22sceneId%22%3A%223562%22%2C%22fromPage%22%3A%22recommend%22%7D&pdp_npi=6%40dis%21EUR%211.95%211.90%21%21%2115.10%2114.69%21%40211b430817752516947823760e113d%2112000046508435582%21rec%21IT%214115008415%21X%211%210%21n_tag%3A-29919%3Bd%3A16a2e0d2%3Bm03_new_user%3A-29895&utparam-url=scene%3ApcJustForYou%7Cquery_from%3A%7Cx_object_id%3A1005008749050132%7C_p_origin_prod%3A&search_p4p_id=202604031428148076797500366594216870_4",
        'https://it.aliexpress.com/item/1005006124271098.html?spm=a2g0o.home.pcJustForYou.61.615c285e0URQaq&utparam-url=scene%3Asearch%7Cquery_from%3Apc_back_same_best%7Cx_object_id%3A1005006124271098%7C_p_origin_prod%3A&algo_pvid=d83611f0-8c21-4b7b-84f8-5cd93678df61&algo_exp_id=d83611f0-8c21-4b7b-84f8-5cd93678df61&pdp_ext_f=%7B%22order%22%3A%2272%22%2C%22fromPage%22%3A%22search%22%7D&pdp_npi=6%40dis%21EUR%211.75%211.69%21%21%211.97%211.90%21%40211b430817752518123767416e113d%2112000035902937638%21sea%21IT%214115008415%21X%211%210%21n_tag%3A-29919%3Bd%3A16a2e0d2%3Bm03_new_user%3A-29895',
        'https://it.aliexpress.com/item/1005009923595931.html?spm=a2g0o.home.pcJustForYou.126.615c285e0URQaq&gps-id=pcJustForYou&scm=1007.13562.416251.0&scm_id=1007.13562.416251.0&scm-url=1007.13562.416251.0&pvid=7986f5c6-e35e-4017-9a4d-1c3e8b84febb&_t=gps-id:pcJustForYou,scm-url:1007.13562.416251.0,pvid:7986f5c6-e35e-4017-9a4d-1c3e8b84febb,tpp_buckets:668%232846%238110%231995&pdp_ext_f=%7B%22order%22%3A%22204%22%2C%22eval%22%3A%221%22%2C%22sceneId%22%3A%223562%22%2C%22fromPage%22%3A%22recommend%22%7D&pdp_npi=6%40dis%21EUR%218.27%217.99%21%21%2164.11%2161.94%21%40211b430817752518799691455e113d%2112000050588861628%21rec%21IT%214115008415%21XZ%211%210%21n_tag%3A-29919%3Bd%3A16a2e0d2%3Bm03_new_user%3A-29895&utparam-url=scene%3ApcJustForYou%7Cquery_from%3A%7Cx_object_id%3A1005009923595931%7C_p_origin_prod%3A'
    ]

    for i, url in enumerate(urls):
        if url:
            scrape_aliexpress(url)
        if i < len(urls) - 1:
            print('Attesa 1 minuto prima del prossimo scraping...')
            time.sleep(60)
