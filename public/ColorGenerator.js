function ColorGenerator(baseColor) {
    this.baseColor = jQuery.Color(baseColor || '#74DDF2');
    this.i = 0;

    // The Golden Ratio in degrees
    this.phi = 0.61803398874989484820 * 360;

    // For this.correctHue()
    this.hueCorrection = [
        [5,10],
        [45,30],
        [70,50],
        [94,70],
        [100,110],
        [115,125],
        [148,145],
        [177,160],
        [179,182],
        [185,188],
        [225,210],
        [255,250]
    ];
}

ColorGenerator.prototype.nextColor = function(correctHue) {
    if (correctHue === undefined)
        correctHue = true;

    if (correctHue)
        return this.baseColor.hue(this.correctHue(this.baseColor.hue() + this.phi * this.i++));
    else
        return this.baseColor.hue(this.baseColor.hue() + this.phi * this.i++);
};

// Hue correction code from http://vis4.net/labs/colorscales/
ColorGenerator.prototype.correctHue = function(hue) {
    hue = hue * (256/360) % 255;
    var lx = 0;
    var ly = 0;

    for (var i = 0; i < this.hueCorrection.length; ++i)
    {
        var pair = this.hueCorrection[i];
        if (hue === pair[0])
            return pair[1];
        else if (hue < pair[0])
        {
            var newHue = ly + (pair[1] - ly)/(pair[0] - lx) * (hue - lx);
            return Math.floor(newHue * 360/256);
        }

        lx = pair[0];
        ly = pair[1];
    }
};
