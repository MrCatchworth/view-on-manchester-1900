var map;
var mapMarkers = [];

var enableRolloverPopups = true;

var imageComparison = {
    isShown: false,
    divContainer: null,
    divPast: null,
    divPresent: null,
    divComparison: null,
    divArticle: null,
    
    currentActiveMarker: null,

    clear:function() {
        this.divComparison.finish();
        this.divArticle.finish();

        this.divComparison.fadeOut(300, function() {
            imageComparison.divPast.find('img').remove();
            imageComparison.divPresent.find('img').remove();
            imageComparison.isShown = false;
        });
        this.divArticle.fadeOut(300, function() {
            this.divArticle.empty();
        });
    },

    setup:function(feature) {
        let mediaSpec = feature.spec.media;
        if ('imagePast' in mediaSpec) {
            this.divPast.append($('<img>', {src: mediaSpec.imagePast}));
        }
        if ('imagePresent' in mediaSpec) {
            this.divPresent.append($('<img>', {src: mediaSpec.imagePresent}));
        }

        if (feature.articleDiv) {
            this.divArticle.append(feature.articleDiv);
            this.divArticle.fadeIn(300);
        }
        else if ('article' in mediaSpec) {
            $.ajax(mediaSpec.article, {
                type:'get',
                success:function(data) {
                    if (imageComparison.currentActiveMarker !== feature) return;
                    feature.articleDiv = $('<div class="article"/>');
                    feature.articleDiv.append($.parseHTML(data));
                    imageComparison.divArticle.append(feature.articleDiv);
                    imageComparison.divArticle.fadeIn(300);
                }
            });
        }

        this.divComparison.fadeIn(300);
        this.isShown=true;
    },

    setActiveMarker:function(feature) {
        if (this.currentActiveMarker === feature) return;

        if (this.isShown) {
            this.clear();
        }
        if (feature !== null) {
            this.divComparison.promise().done(function(div) {
                imageComparison.setup(feature);
            });
        }
        this.currentActiveMarker = feature;
    }
};

function createPopup(spec) {
    let popupDiv = $('<div class="popup"><h2/><p/></div>');
    popupDiv.find('h2').append(spec.name);
    popupDiv.find('p').append(spec.popup.description);
    if ('image' in spec.popup) {
        let popupImg = $('<img class="popup_thumb"/>');
        popupImg.attr('src', spec.popup.image);
        popupDiv.append(popupImg);
    }
    return popupDiv;
}

function createMapMarker(spec) {
    //create OL object and extend it with our own stuff
    let feature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat(spec.coords))
    });

    feature.setStyle(
        new ol.style.Style({
            scale:3,
            image: new ol.style.Icon({
                src:'map-pin-pink.png',
                anchor: [0.5, 1]
            })
        })
    );

    feature.name = spec.name;
    feature.coords = spec.coords;
    feature.spec = spec;

    //create its popup and just hide it so we don't need it right now
    let popupDiv = createPopup(spec);
    $('body').append(popupDiv);

    feature.popupDiv = popupDiv;
    feature.isRolledOver = false;

    feature.onRollOver = function() {
        if (!this.isRolledOver) 
        {
            this.isRolledOver = true;
            let pixel = map.getPixelFromCoordinate(this.getGeometry().getCoordinates());
            this.popupDiv.css('left', pixel[0]);
            this.popupDiv.css('top', pixel[1]);
            this.popupDiv.finish();
            this.popupDiv.fadeIn(100);
        }
    }

    feature.onRollOut = function() {
        if (this.isRolledOver) {
            this.isRolledOver = false;
            this.popupDiv.finish();
            this.popupDiv.fadeOut(100);
        }
    }

    return feature;
}

function init() {
    //setup dom element references
    imageComparison.divContainer = $('#imgcomparecontainer');
    imageComparison.divPast = $('#imgpast');
    imageComparison.divPresent = $('#imgpresent');
    imageComparison.divComparison = $('#imagecomparison');
    imageComparison.divArticle = $('#articlecontainer');

    var markerVectors = new ol.source.Vector({
        features: []
    })
    map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            }),
            new ol.layer.Vector({
                source: markerVectors
            })
        ],
        view: new ol.View({
            center: [-249941.32538331934, 7072451.12963516],
            extent: [-252962.64131447076, 7068810.726146504, -246736.79253167726, 7074632.104797532],
            zoom: 15,
            minZoom: 15,
            maxZoom: 18
        })
    });

    //switch active marker on click
    map.on('singleclick', function(event) {
        var featuresHit = map.getFeaturesAtPixel(event.pixel);
        if (featuresHit !== null) {
            imageComparison.setActiveMarker(featuresHit[0]);
        }
    });

    map.on('movestart', function(event) {
        enableRolloverPopups = false;
        for (let feature of mapMarkers) {
            feature.onRollOut();
        }
    });
    map.on('moveend', function(event) {
        enableRolloverPopups = true;
    })

    //make markers look like hyperlinks
    map.on('pointermove', function(event) {
        map.getTargetElement().style.cursor = map.hasFeatureAtPixel(event.pixel) ? 'pointer' : '';
    });

    //popup feature name (and other stuff, TODO) on roll over marker
    map.on('pointermove', function(event) {
        if (!enableRolloverPopups) return;

        let featuresHit;
        if (map.hasFeatureAtPixel(event.pixel)) {
            featuresHit = map.getFeaturesAtPixel(event.pixel);
        } else {
            featuresHit = [];
        }

        for (let marker of mapMarkers) {
            if (featuresHit.includes(marker)) {
                marker.onRollOver();
            } else {
                marker.onRollOut();
            }
        }
    });
    //just try to catch any mouse movements that slip the net
    $('#map').mouseleave(function() {
        for (let marker of mapMarkers) {
            marker.onRollOut();
        }
    });

    //load markers from other file
    $.getJSON('markers.json', function(data) {
        $.each(data, function(i, markerSpec) {
            let newMarker = createMapMarker(markerSpec)
            markerVectors.addFeature(newMarker);
            mapMarkers.push(newMarker);
        })
    });
}