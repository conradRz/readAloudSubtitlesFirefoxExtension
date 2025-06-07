(function () {
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        try {
            const parsedUrl = new URL(url, location.origin);
            const pot = parsedUrl.searchParams.get('pot');
            if (pot) {
                window.dispatchEvent(new CustomEvent('FoundPOT', { detail: pot }));
            }
        } catch (e) {
            console.warn('Failed to parse URL:', url, e);
        }
        return origOpen.apply(this, arguments);
    };
})();