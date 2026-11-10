(function () {
  var YOUTUBE_ID = "-yooOIcc55I";
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  function money(v) {
    var n = parseFloat(v);
    return "$" + (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2));
  }

  // Prices come from the server so the page always matches what checkout charges.
  fetch("/api/config").then(function (r) { return r.ok ? r.json() : null; }).then(function (c) {
    if (!c) return;
    document.querySelectorAll("[data-price]").forEach(function (el) {
      var p = c.prices[el.getAttribute("data-price")];
      if (p) el.textContent = money(p);
    });
    var free = parseFloat(c.shipping) === 0;
    document.querySelectorAll("[data-ship]").forEach(function (el) {
      el.textContent = free ? "free US shipping" : "+ " + money(c.shipping) + " shipping";
    });
  }).catch(function () {});

  // Video loads from YouTube only when clicked.
  var v = document.getElementById("video");
  if (v) v.addEventListener("click", function () {
    if (v.querySelector("iframe")) return;
    v.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + YOUTUBE_ID +
      '?autoplay=1&rel=0" title="You\'re My Son" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
  });

  // Product photo galleries.
  document.querySelectorAll("[data-gallery]").forEach(function (card) {
    var main = card.querySelector("[data-main]");
    card.querySelectorAll(".thumbs button").forEach(function (b) {
      b.addEventListener("click", function () {
        main.src = b.getAttribute("data-src");
        card.querySelectorAll(".thumbs button").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
      });
    });
  });

  // Checkout buttons.
  var err = document.getElementById("buy-error");
  document.querySelectorAll("[data-buy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var product = btn.getAttribute("data-buy");
      var body = { product: product };
      if (err) err.textContent = "";
      var sel = document.getElementById(product + "-size");
      if (sel) {
        if (!sel.value) { sel.focus(); if (err) err.textContent = "Please choose a tee size."; return; }
        body.size = sel.value;
      }
      btn.disabled = true;
      fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d.url) { window.location = d.url; return; }
        throw new Error(d.error || "Could not start checkout.");
      }).catch(function (e) {
        btn.disabled = false;
        if (err) err.textContent = e.message || "Could not start checkout. Please try again.";
        if (err && !document.getElementById(product + "-size")) err.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  });
})();
