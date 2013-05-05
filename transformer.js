/* Transformer.js | (c) 2013 Petro Salema | petrosalema.github.io/transformer */
// euclidean.js
(function Transformer(global, mandox, math, $) {
	'use strict';

	if (mandox) {
		eval(uate)('tranformer.js');
	}

	/**
	 * The vendor prefix string for the host rendering engine.
	 *
	 * @type {string}
	 */
	var VENDOR_PREFIX = (function (prefixes) {
		var $element = $('<div></div');
		var i;
		for (i = 0; i < prefixes.length; i++) {
			if (typeof $element.css(prefixes[i] + '-transform') !== 'undefined') {
				return prefixes[i];
			}
		}
		return '';
	}(['-webkit', '-moz', '-o']));

	function enableSelection($element) {
		($element || $('body')).each(function () {
			$(this).removeAttr('unselectable', 'on')
			       .css(VENDOR_PREFIX + '-user-select', 'all');
		}).each(function () {
			this.onselectstart = null;
		});
	}

	function disableSelection($element) {
		($element || $('body')).each(function () {
			$(this).attr('unselectable', 'on')
			       .css(VENDOR_PREFIX + '-user-select', 'none');
		}).each(function () {
			this.onselectstart = function () { return false; };
		});
	}

	/**
	 * Angles of the 16-point compass rose.
	 *
	 * Reference: https://en.wikipedia.org/wiki/Compass_rose
	 *
	 * @type {object<string, number}
	 */
	var compass = (function () {
		var eigth = 45;
		var sixteenth = eigth / 2;
		var n   = 0;
		var e   = 90;
		var s   = 180;
		var w   = 270;
		var ne  = n  + eigth;
		var se  = e  + eigth;
		var sw  = s  + eigth;
		var nw  = w  + eigth;
		var nne = n  + sixteenth;
		var ene = ne + sixteenth;
		var nnw = nw + sixteenth;
		var wnw = w  + sixteenth;
		var sse = s  - sixteenth;
		var ese = se - sixteenth;
		var ssw = sw - sixteenth;
		var wsw = w  - sixteenth;
		return {
			n   : math.to_rad(n),
			e   : math.to_rad(e),
			s   : math.to_rad(s),
			w   : math.to_rad(w),
			ne  : math.to_rad(ne),
			se  : math.to_rad(se),
			sw  : math.to_rad(sw),
			nw  : math.to_rad(nw),
			nne : math.to_rad(nne),
			ene : math.to_rad(ene),
			nnw : math.to_rad(nnw),
			wnw : math.to_rad(wnw),
			sse : math.to_rad(sse),
			ese : math.to_rad(ese),
			ssw : math.to_rad(ssw),
			wsw : math.to_rad(wsw)
		};
	}());

	/**
	 * DOM elements for the 8 cardinals and ordinals of the compass.
	 *
	 * Reference: https://en.wikipedia.org/wiki/Principal_winds
	 */
	var winds = {
		n  : $('<div class="transformer-marker" id="transformer-marker-n" ><div></div></div>').appendTo('body'),
		s  : $('<div class="transformer-marker" id="transformer-marker-s" ><div></div></div>').appendTo('body'),
		e  : $('<div class="transformer-marker" id="transformer-marker-e" ><div></div></div>').appendTo('body'),
		w  : $('<div class="transformer-marker" id="transformer-marker-w" ><div></div></div>').appendTo('body'),
		nw : $('<div class="transformer-marker" id="transformer-marker-nw"><div></div></div>').appendTo('body'),
		sw : $('<div class="transformer-marker" id="transformer-marker-sw"><div></div></div>').appendTo('body'),
		ne : $('<div class="transformer-marker" id="transformer-marker-ne"><div></div></div>').appendTo('body'),
		se : $('<div class="transformer-marker" id="transformer-marker-se"><div></div></div>').appendTo('body')
	};

	var $markers = (function (markers) {
		var $markers = $();
		var point;
		for (point in markers) {
			if (markers.hasOwnProperty(point)) {
				$markers = $markers.add(markers[point]);
			}
		}
		return $markers;
	}(winds));

	var $boundingbox = $('<div id="transformer-boundingbox">').appendTo('body');
	var $pivot = $('<div id="transformer-pivot">').appendTo('body');

	/**
	 * Calculates the dimensions of a bounding box for the given element when
	 * orientated according to the specified angle.
	 *
	 * Reference: http://www.codalicio.us/2011/01/how-to-determine-bounding-rectangle-of.html
	 *
	 * @returns {Array.<number>} [x, y, w, h]
	 */
	function computeBoundingBox($element, angle) {
		var w = $element.outerWidth();
		var h = $element.outerHeight();

		if (angle > math.HALF_ANGLE) {
			angle -= math.HALF_ANGLE;
		}
		if (angle > math.RIGHT_ANGLE) {
			angle -= math.RIGHT_ANGLE;
			var originalHeight = w;
			w = h;
			h = originalHeight;
		}

		var offset = $element.offset();

		return [
			offset.left,
			offset.top, (
				// Because a = cos(q) * h
				(Math.cos(math.RIGHT_ANGLE - angle) * h)
				+
				(Math.cos(angle) * w)
			), (
				// Because o = sin(q) * h
				(Math.sin(math.RIGHT_ANGLE - angle) * h)
				+
				(Math.sin(angle) * w)
			)
		];
	}

	/**
	 * Calculates the absolute center coordinates of the given bounding box.
	 */
	function computeOrigin(box) {
		return [box[0] + (box[2] / 2), box[1] + (box[3] / 2)];
	}

	/**
	 * The unit matrix from which transformation are made
	 *
	 * The transformation matrix is in column-major order:
	 *
	 * A = | a b tx |
	 *     | c d ty |
	 *
	 * is represented contiguously as the sequence [ a c  b d  tx ty ]
	 *
	 * where:
	 * <a c> is the vector in the direction of the x-axis,
	 * <b d> is the vector in the direction of the y-axis,
	 * and <tx ty> is the offset from the origin
	 *
	 * References:
	 * https://en.wikipedia.org/wiki/Standard_basis
	 * https://en.wikipedia.org/wiki/Column-major_order#Column-major_order):
	 */
	var STANDARD_BASIS = math.matrix(
		[1, 0, 0],
		[0, 1, 0]
	);

	/**
	 * Generates a matrix transformation CSS string to transform an element.
	 *
	 * References:
	 * http://www.w3.org/TR/SVG/coords.html#TransformMatrixDefined
	 * http://www.useragentman.com/IETransformTranslator/
	 * http://dev.opera.com/articles/view/understanding-the-css-transforms-matrix/#calculatingtransform
	 * https://developer.mozilla.org/en-US/docs/CSS/trasnform
	 * http://en.wikipedia.org/wiki/Coordinate_rotation
	 * http://en.wikipedia.org/wiki/Transformation_matrix
	 */
	function css_transformation_matrix(operation) {
		var matrix = STANDARD_BASIS;
		if (typeof operation.rotation !== 'undefined') {
			matrix = math.m_rotate(matrix, operation.rotation);
		}
		if (typeof operation.translation !== 'undefined') {
			matrix = math.m_translate(matrix, operation.translation);
		}
		if (typeof operation.scaling !== 'undefined') {
			matrix = math.m_scale(matrix, operation.scale);
		}
		if (typeof operation.skew !== 'undefined') {
			matrix = math.m_skew(matrix, operation.skew);
		}
		return 'matrix(' + matrix.toString() + ')';
	}

	var SIGNED_FLOATING_POINT = /(\-?[0-9]*\.?[0-9]+)/g;

	function parse_transformation_matrix(transformation) {
		console.log(transformation);
	}

	/**
	 * Given matrix A, where
	 *
	 * A = | a b tx |
	 *     | c d ty |
	 *
	 * is represented as the sequence [ a c  b d  tx ty ]
	 *
	 * rotation t = atan(c/d) = atan(-b/a)
	 *
	 * Reference:
	 * http://stackoverflow.com/questions/4361242/extract-rotation-scale-values-from-2d-transformation-matrix
	 *
	 * @todo: parseFloat()
	 */
	function get_rotation_angle(matrix) {
		var rotation = Math.atan(matrix[1] / matrix[3]);

		// Because singularities exists at multiples of 90°.  This means that
		// deriving the rotation angle from a rotation matrix is ambigious.  In
		// order to resolve this ambiguity, it is necessary to determine in
		// which quadrant in the cartesian coordinate system the x-axis vector
		// is in, and with it, modify the derived rotation angle if necessary.
		if (matrix[0] < 0) {
			rotation += math.HALF_ANGLE;
		}

		return math.normalize_angle(rotation);
	}

	/**
	 * Gets the given elements rotation.
	 */
	function getElementRotation($element) {
		var matrix = $element.css(VENDOR_PREFIX + '-transform')
		                     .match(SIGNED_FLOATING_POINT);
		return matrix ? get_rotation_angle(matrix) : 0;
	}

	function getDirectionVector(angle) {
		// Because the atan2() function expects the angle of the normal to be
		// calculated from the origin (0, 0).
		var directional = math.normalize_angle(angle) - math.RIGHT_ANGLE;
		return [Math.cos(directional), Math.sin(directional)];
	}

	/**
	 * Given a cardinal or ordinal direction, will return the corresponding
	 * direction at a given angle from it.
	 *
	 * Reference: https://en.wikipedia.org/wiki/Cardinal_direction
	 */
	var rotateDirection = (function () {
		return function rotateDirection(point, angle) {
			angle = math.normalize_angle(angle + compass[point]);
			return ((angle < compass.nne)
				? 'n'
				: (angle < compass.ene)
				? 'ne'
				: (angle < compass.ese)
				? 'e'
				: (angle < compass.sse)
				? 'se'
				: (angle < compass.ssw)
				? 's'
				: (angle < compass.wsw)
				? 'sw'
				: (angle < compass.wnw)
				? 'w'
				: (angle < compass.nnw)
				? 'nw'
				: 'n');
		};
	}());

	/**
	 * Updates the resize cursors of all the marker elements.
	 */
	var updateCursors = (function () {
		var cursors = {
			n  : 'ns-resize',
			e  : 'ew-resize',
			s  : 'ns-resize',
			w  : 'ew-resize',
			ne : 'ne-resize',
			sw : 'sw-resize',
			se : 'se-resize',
			nw : 'nw-resize'
		};
		return function updateCursors(orientation) {
			var point;
			for (point in winds) {
				if (winds.hasOwnProperty(point)) {
					winds[point].css(
						'cursor',
						cursors[rotateDirection(point, orientation.rotation)]
					);
				}
			}
		};
	}());

	/**
	 * Orientates and shows the given markers around the rotation.
	 */
	function showMarkers(orientation) {
		if (!orientation) {
			return;
		}

		var width = orientation.$element.outerWidth();
		var height = orientation.$element.outerHeight();

		var n  = [0, -height / 2];
		var s  = [0,       -n[1]];
		var e  = [width / 2,   0];
		var w  = [-e[0],       0];
		var nw = [w[0],     n[1]];
		var ne = [e[0],     n[1]];
		var sw = [w[0],     s[1]];
		var se = [e[0],     s[1]];

		var directions = {
			n  : n,
			s  : s,
			e  : e,
			w  : w,
			nw : nw,
			ne : ne,
			sw : sw,
			se : se
		};

		var origin = computeOrigin(computeBoundingBox(
			orientation.$element,
			orientation.rotation
		));

		var point;
		var pos;
		for (point in directions) {
			if (directions.hasOwnProperty(point)) {
				pos = math.v_add(
					math.v_rotate(directions[point], orientation.rotation),
					origin
				);
				winds[point].css('left', pos[0]).css('top', pos[1]).show();
			}
		}

		var offset = orientation.$element.offset();

		$boundingbox.show().offset(offset)
		            .css('width', (origin[0] - offset.left) * 2)
		            .css('height', (origin[1] - offset.top) * 2);

		$pivot.show().css('left', origin[0]).css('top', origin[1]);

		updateCursors(orientation);
	}

	/**
	 * Hides rotation markers.
	 */
	(function hideMarkers() {
		$pivot.hide();
		$markers.hide();
		$boundingbox.hide();
	}());


	// ---------- `creating ----------


	function startCreating(x, y) {
		disableSelection();
		var $element = $('<div class="transformer-element">⇡</div>').appendTo('body');
		$element.css('position', 'absolute').css({
			left: x,
			top: y
		});
		return {create: {
			$element: $element,
			x: x,
			y: y,
			rotation: 0
		}};
	}

	function updateCreating(operation, x, y) {
		operation.$element.css({
			width: x - operation.x,
			height: y - operation.y
		});
	}

	function endCreating(operation) {
		return operation.$element;
	}


	// ---------- `rotating ----------


	/**
	 * Initializes rotation for the given element at point (x, y).
	 */
	function startRotating(element, x, y) {
		disableSelection();
		var $element = $(element);
		var rotation = getElementRotation($element);
		var bounding = computeBoundingBox($element, rotation);
		var anchor = [x, y];
		var origin = computeOrigin(bounding);
		var angle = math.angular_direction(math.v_subtract(anchor, origin));

		return {rotate: {
			x: bounding[0],
			y: bounding[1],
			$element : $element,
			origin: origin,
			anchor: anchor,
			angle: angle,
			rotation: rotation
		}};
	}

	/**
	 * Updates the rotation according to the new coordinates (x, y).
	 */
	function updateRotating(operation, x, y) {
		var theta = math.angular_direction(
			math.v_subtract([x, y], operation.origin)
		);
		operation.rotation = math.normalize_angle(
			operation.rotation + (theta - operation.angle)
		);
		operation.angle = theta;
		operation.$element.css(
			VENDOR_PREFIX + '-transform',
			css_transformation_matrix(operation)
		);
	}

	/**
	 * Saves the current rotation angle as an attribute on the rotated element
	 * and hides boundingbox, pivot, and markers.
	 */
	function endRotating(operation) {
		return operation.$element;
	}


	// ---------- `resizing ----------


	function startResizing($element, marker, x, y) {
		disableSelection();
		var $marker = $(marker).closest('.transformer-marker');
		var direction = $marker[0].id.replace('transformer-marker-', '');
		var offset = $marker.offset();
		var rotation = getElementRotation($element);
		var normal = compass[direction] + rotation;
		return {resize: {
			$marker: $marker,
			$element: $element,
			direction: getDirectionVector(normal),
			start: [offset.left, offset.top],
			normal: normal,
			compassDirection: direction,
			rotation: rotation
		}};
	}

	// https://en.wikipedia.org/wiki/Vector_projection
	function updateResizing(operation, x, y) {
		var delta = [x - operation.start[0], y - operation.start[1]];
		var direction = operation.direction;
		var $element = operation.$element;
		var projection = math.v_project(delta, direction);
		var position = math.v_add(operation.start, projection);
		var scalarProjection = math.v_scalar_projection(delta, direction);
		var offset = $element.offset();

		if ('w' === operation.compassDirection
				|| 'e' === operation.compassDirection) {
			operation.w = $element.width() + scalarProjection;
			$element.width($element.width() + scalarProjection);
		} else if ('n' === operation.compassDirection
				|| 's' === operation.compassDirection) {
			$element.height($element.height() + scalarProjection);
		}

		if (direction[0] < 0) {
			offset.left = offset.left + (scalarProjection * direction[0]);
		}
		if (direction[1] < 0) {
			offset.top = offset.top + (scalarProjection * direction[1]);
		}

		$element.offset(offset);

		operation.$marker.css({
			left: position[0],
			top: position[1]
		});

		operation.start = position;
	}

	function endResizing(operation) {
		return operation.$element;
	}


	// ---------- `moving ----------


	function startMoving(element, x, y) {
		disableSelection();
		var $element = $(element);
		return {move: {
			$element: $element,
			position: [x, y],
			rotation: getElementRotation($element)
		}};
	}

	function updateMoving(operation, x, y) {
		var offset = operation.$element.offset();
		var position = [x, y];
		var current = [offset.left, offset.top];
		var delta = math.v_add(
			current,
			math.v_subtract(position, operation.position)
		);
		operation.$element.offset({
			left : delta[0],
			top  : delta[1]
		});
		operation.position = position;
	}

	function endMoving(operation) {
		return operation.$element;
	}


	function update(operation, x, y) {
		if (operation.create) {
			updateCreating(operation.create, x, y);
		} else if (operation.rotate) {
			updateRotating(operation.rotate, x, y);
		} else if (operation.resize) {
			updateResizing(operation.resize, x, y);
		} else if (operation.move) {
			updateMoving(operation.move, x, y);
		}
		showMarkers(
			operation.create
				|| operation.rotate
					|| operation.resize
						|| operation.move
		);
	}

	function end(operation) {
		enableSelection();
		if (operation.create) {
			endCreating(operation.create);
		} else if (operation.rotate) {
			endRotating(operation.rotate);
		} else if (operation.resize) {
			endResizing(operation.resize);
		} else if (operation.move) {
			endMoving(operation.move);
		}
		var orientation = operation.create
		               || operation.rotate
		               || operation.resize
		               || operation.move;
		showMarkers(orientation);
		return orientation.$element;
	}

	/**
	 * ___ __          __ __ __  __      __ __
	 *  | |__) /\ |\ |(_ |_ /  \|__)|\/||_ |__)
	 *  | | \ /--\| \|__)|  \__/| \ |  ||__| \
	 * >--------------------------------------->
	 */
	global.Transformer = {
		startCreating : startCreating,
		startRotating : startRotating,
		startResizing : startResizing,
		startMoving   : startMoving,

		updateCreating : updateCreating,
		updateRotating : updateRotating,
		updateResizing : updateResizing,
		updateMoving   : updateMoving,

		endCreating : endCreating,
		endRotating : endRotating,
		endResizing : endResizing,
		endMoving   : endMoving,

		update: update,
		end: end,

		enableSelection: enableSelection,
		disableSelection: disableSelection,

		VENDOR_PREFIX: VENDOR_PREFIX
	};

}(window, window.mandox, window.MathUtil, window.jQuery));
