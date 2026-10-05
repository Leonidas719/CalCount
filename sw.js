const CACHE_NAME = "nutritrack-v1.3";

const APP_FILES = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json"
];


/* INSTALL */

self.addEventListener(
    "install",
    event => {

        event.waitUntil(

            caches.open(CACHE_NAME)
                .then(
                    cache =>
                        cache.addAll(APP_FILES)
                )

        );

        self.skipWaiting();

    }
);


/* ACTIVATE */

self.addEventListener(
    "activate",
    event => {

        event.waitUntil(

            caches.keys()
                .then(
                    keys =>
                        Promise.all(

                            keys
                                .filter(
                                    key =>
                                        key !== CACHE_NAME
                                )
                                .map(
                                    key =>
                                        caches.delete(key)
                                )

                        )
                )

        );

        self.clients.claim();

    }
);


/* FETCH */

self.addEventListener(
    "fetch",
    event => {

        const request =
            event.request;


        /*
         * Open Food Facts:
         * always use the internet first.
         */

        if (
            request.url.includes(
                "world.openfoodfacts.org"
            )
        ) {

            event.respondWith(

                fetch(request)
                    .catch(
                        () =>
                            new Response(
                                JSON.stringify({
                                    products: [],
                                    offline: true
                                }),
                                {
                                    headers: {
                                        "Content-Type":
                                            "application/json"
                                    }
                                }
                            )
                    )

            );

            return;

        }


        /*
         * App files:
         * cache first, then network.
         */

        event.respondWith(

            caches.match(request)
                .then(
                    cached => {

                        if (cached) {

                            return cached;

                        }


                        return fetch(request)
                            .then(
                                response => {

                                    if (
                                        !response ||
                                        response.status !== 200
                                    ) {

                                        return response;

                                    }


                                    const copy =
                                        response.clone();


                                    caches.open(
                                        CACHE_NAME
                                    ).then(
                                        cache =>
                                            cache.put(
                                                request,
                                                copy
                                            )
                                    );


                                    return response;

                                }
                            );

                    }
                )

        );

    }
);