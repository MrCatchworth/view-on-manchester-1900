'use strict';

var map;

function throwUnimpError(obj) {
    throw new Error('Attempt to call unimplemented function in ' + obj.constructor.name);
}

//custom vector source which can group features, like Cluster, but adds explicitly defined geometries which group markers rather than going by pixel distance
//it also shows the grouped markers individually when over a certain resolution threshold
//it's bespoke enough that a project-related name is not crazy
class MancSource extends ol.source.Vector {
    constructor(options) {
        super({
            attributions: options.attributions,
            extent: options.extent,
            projection: options.projection,
            wrapX: options.wrapX
        });
        this.source = options.source;
        this.minGroupingResolution = options.minGroupingResolution;

        this.groups = [];
        this.looseFeatures = [];
        this.resolution = undefined;
    }

    refreshFeatures() {
        if (this.resolution === undefined) return;
        const features = this.source.getFeatures();

        this.looseFeatures = [];
        for (let group of this.groups) {group.containedFeatures = [];}

        //add all features which are not in any group, as we know these will never be grouped
        for (let feature of features) {
            let isLoose = true;
            for (let group of this.groups) {
                if (group.geometry.intersectsCoordinate(feature.getGeometry().getCoordinates())) {
                    isLoose = false;
                    group.containedFeatures.push(feature);
                    break;
                }
            }
            feature.isLoose = isLoose;
            if (feature.isLoose) {
                this.looseFeatures.push(feature);
            }
        }

        this.clear();
        this.addFeatures(this.looseFeatures);

        for (let group of this.groups) {
            if (this.resolution >= this.minGroupingResolution) {
                group.mainFeature.isGroupFeature = true;
                this.addFeature(group.mainFeature);
            } else {
                this.addFeatures(group.containedFeatures);
            }
        }
    }

    refresh() {
        this.refreshFeatures();
        super.refresh(this);
    }

    loadFeatures(extent, resolution, projection) {
        this.source.loadFeatures(extent, resolution, projection);

        // if (resolution === this.resolution) return;
        this.resolution = resolution;
        this.refreshFeatures();
    }

    addGroup(group) {
        this.groups.push(group);
    }
}

class Displayable {
    constructor(feature, json) {
        this.feature = feature;
        this.isShown = false;
    }

    onClear() {
        throwUnimpError(this);
    }
    
    onSetActive() {
        throwUnimpError(this);
    }

    get isShown() {
        return this._isShown;
    }
    set isShown(val) {
        this._isShown = val;
    }
}

class ImageMedia extends Displayable {
    constructor(feature, json) {
        super(feature, json);
        this.src = json.src;
        this.imgTag = null;
    }

    onClear() {
        this.imgTag.remove();
        this.imgTag = null;
    }

    onSetActive() {
        this.imgTag = $('<img class="mediaImage">');
        this.imgTag.attr('src', this.src);
        sidebar.mediaContainer.append(this.imgTag);
    }
}

class YoutubeMedia extends Displayable {
    constructor(feature, json) {
        super(feature, json);
        this.videoHtml = `<iframe class="youtubeembed" src="https://www.youtube.com/embed/${json.videoid}?autoplay=1&loop=1" frameborder="0" allow="autoplay; encrypted-media"></iframe>`;
        this.videoTag = null;
    }

    onClear() {
        this.videoTag.remove();
        this.videoTag = null;
    }

    onSetActive() {
        this.videoTag = $(this.videoHtml);
        sidebar.mediaContainer.append(this.videoTag);
    }
}

class HTMLArticle extends Displayable {
    constructor(feature, json) {
        super(feature, json);
        this.src = json.src;
        this.articleTag = null;
        this.articleHtml = null;

        var thisArticle = this;
        $.ajax(this.src, {
            success(data) {
                thisArticle.articleHtml = data;
                //we might be already on-stage, in which case we'd better get ourselves attached right now
                if (thisArticle.articleTag !== null) {
                    thisArticle.articleTag.append($(thisArticle.articleHtml));
                }
            }
        });
    }

    onClear() {
        this.articleTag.remove();
        this.articleTag = null;
    }

    onSetActive() {
        this.articleTag = $('<div class="article" />');
        sidebar.articleContainer.append(this.articleTag);
        if (this.articleHtml !== null) {
            this.articleTag.append($(this.articleHtml));
        }
    }
}

var markers = {
    list: [],
    mediaTypes: [
        ['image', ImageMedia],
        ['youtube', YoutubeMedia]
    ],
    articleTypes: [
        ['html', HTMLArticle]
    ],

    baseSource: null,
    mancSource: null,
    clusterLayer: null,
    styleSingleMarker: null,
    styleClusterMarker: null,
    init() {
        this.styleSingleMarker = new ol.style.Style({
            scale:3,
            image: new ol.style.Icon({
                src:'marker_single.png',
                anchor: [0.5, 1]
            })
        });
        this.styleClusterMarker = new ol.style.Style({
            scale:3,
            image: new ol.style.Icon({
                src:'marker_cluster.png',
                anchor: [0.5, 1]
            })
        });
        this.baseSource = new ol.source.Vector({
            features: []
        });
        this.mancSource = new MancSource({
            minGroupingResolution: 1.5,
            source: this.baseSource
        });
        this.clusterLayer = new ol.layer.Vector({
            source: markers.mancSource,
            style: function(feature) {
                if (feature.isGroupFeature) {
                    return markers.styleClusterMarker;
                } else {
                    return markers.styleSingleMarker;
                }
            }
        });
    },
    
    parse(json) {
        //create OL object and extend it with our own stuff
        let feature = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.fromLonLat([json.coords[1], json.coords[0]]))
        });

        feature.name = json.name;
        feature.coords = json.coords;

        let mediaClass = this.mediaTypes.filter(item => item[0] == json.media.type)[0][1];
        feature.media = new mediaClass(feature, json.media);
        let articleClass = this.articleTypes.filter(item => item[0] == json.article.type)[0][1];
        feature.article = new articleClass(feature, json.article);

        if ('popup' in json) {
            //create its popup and just hide it so we don't need it right now
            let popupDiv = createPopup(json);
            $('body').append(popupDiv);
            feature.popupDiv = popupDiv;
        } else {
            feature.popupDiv = null;
        }

        
        feature.isRolledOver = false;
        feature.onRollOver = function() {
            if (this.popupDiv === null) return;
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
            if (this.popupDiv === null) return;
            if (this.isRolledOver) {
                this.isRolledOver = false;
                this.popupDiv.finish();
                this.popupDiv.fadeOut(100);
            }
        }

        return feature;
    }
}

var enableRolloverPopups = true;

var sidebar = {
    mediaContainer: null,
    articleContainer: null,
    bothContainers: null,
    currentActiveMarker: null,

    init() {
        this.mediaContainer = $('#mediacontainer');
        this.articleContainer = $('#articlecontainer');

        this.bothContainers = $('#mediacontainer, #articlecontainer');

        this.bothContainers.fadeOut(0);
    },

    clearCurrentMarker() {
        var thisSidebar = this;
        var clearPromise = this.bothContainers.fadeOut(300).promise();
        clearPromise.done(function() {
            thisSidebar.currentActiveMarker.media.onClear();
            thisSidebar.currentActiveMarker.article.onClear();
        });
        return clearPromise;
    },

    displayCurrentMarker() {
        this.currentActiveMarker.media.onSetActive();
        this.currentActiveMarker.article.onSetActive();
    },

    applyActiveMarker(feature) {
        this.currentActiveMarker = feature;
        if (this.currentActiveMarker !== null) {
            this.displayCurrentMarker();
            this.bothContainers.fadeIn(300);
        }
    },

    setActiveMarker(feature) {
        this.bothContainers.finish();
        if (this.currentActiveMarker !== null) {
            var thisSidebar = this;
            this.clearCurrentMarker().done(function() {
                thisSidebar.applyActiveMarker(feature);
            });
        } else {
            this.applyActiveMarker(feature);
        }
    }
}

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

function init() {
    //setup dom element references
    sidebar.init();
    markers.init();

    map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            }),
            markers.clusterLayer
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
            sidebar.setActiveMarker(featuresHit[0]);
        } else {
            sidebar.setActiveMarker(null);
        }
    });

    map.on('movestart', function(event) {
        enableRolloverPopups = false;
        for (let feature of markers.list) {
            feature.onRollOut();
        }
    });
    map.on('moveend', function(event) {
        enableRolloverPopups = true;
    });

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

        for (let marker of markers.list) {
            if (featuresHit.includes(marker)) {
                marker.onRollOver();
            } else {
                marker.onRollOut();
            }
        }
    });
    //just try to catch any mouse movements that slip the net
    $('#map').mouseleave(function() {
        for (let marker of markers.list) {
            marker.onRollOut();
        }
    });

    //load markers from other file
    $.getJSON('markers.json', function(data) {
        $.each(data.markers, function(i, markerSpec) {
            let newMarker = markers.parse(markerSpec);
            markers.baseSource.addFeature(newMarker);
            markers.list.push(newMarker);
        });
        $.each(data.groups, function(i, data) {
            //parse a geometry and marker from the name
            let center = ol.proj.fromLonLat([data.center[1], data.center[0]]);
            let group = {
                geometry: new ol.geom.Circle(center, data.radius),
                mainFeature: new ol.Feature({
                    geometry: new ol.geom.Point(center)
                })
            };
            markers.mancSource.addGroup(group);
        })
    });
}