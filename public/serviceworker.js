self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open('miband').then(function(cache) {
      return cache.addAll([
        '/',
        '/index.html',
        '/favicon.png',
        '/webapp.bundle.js'
      ]);
    })
  );
});

self.addEventListener('fetch', function(event) {
  console.log(event.request.url);

  event.respondWith(
    fetch(event.request).then(function(response){
      return caches.open('miband').then(function(cache){
        cache.put(event.request.url, response.clone());
        return response;
      });
    }).catch(function() {
      return caches.match(event.request);
    })
  );
});
