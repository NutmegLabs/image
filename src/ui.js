import { base64FromByteArray } from './base64';
import buttonIcon from './svg/button-icon.svg';

/**
 * Class for working with UI:
 *  - rendering base structure
 *  - show/hide preview
 *  - apply tune view
 */
export default class Ui {
  /**
   * @param {object} ui - image tool Ui module
   * @param {object} ui.api - Editor.js API
   * @param {ImageConfig} ui.config - user config
   * @param {Function} ui.onSelectFile - callback for clicks on Select file button
   * @param {boolean} ui.readOnly - read-only mode flag
   * @param {boolean} ui.optimizeImages - optimize images flag
   */
  constructor({ api, config, onSelectFile, readOnly, optimizeImages }) {
    this.api = api;
    this.config = config;
    this.onSelectFile = onSelectFile;
    this.readOnly = readOnly;
    this.appendCaptionOnDemand = true;
    this.nodes = {
      wrapper: make('div', [this.CSS.baseClass, this.CSS.wrapper]),
      imageContainer: make('div', [ this.CSS.imageContainer ]),
      fileButton: this.createFileButton(),
      imageEl: undefined,
      imagePreloader: make('div', this.CSS.imagePreloader),
      caption: make('div', [this.CSS.input, this.CSS.caption], {
        contentEditable: !this.readOnly,
      }),
    };
    this.optimizeImages = config.optimizeImages;

    /**
     * Create base structure
     *  <wrapper>
     *    <image-container>
     *      <image-preloader />
     *    </image-container>
     *    <caption />
     *    <select-file-button />
     *  </wrapper>
     */
    this.nodes.caption.dataset.placeholder = this.config.captionPlaceholder;
    this.nodes.imageContainer.appendChild(this.nodes.imagePreloader);
    this.nodes.wrapper.appendChild(this.nodes.imageContainer);
    if (!readOnly) {
      this.nodes.wrapper.appendChild(this.nodes.caption);
      this.appendCaptionOnDemand = false;
    }
    this.nodes.wrapper.appendChild(this.nodes.fileButton);
  }

  /**
   * CSS classes
   *
   * @returns {object}
   */
  get CSS() {
    return {
      baseClass: this.api.styles.block,
      loading: this.api.styles.loader,
      input: this.api.styles.input,
      button: this.api.styles.button,

      /**
       * Tool's classes
       */
      wrapper: 'image-tool',
      imageContainer: 'image-tool__image',
      imagePreloader: 'image-tool__image-preloader',
      imageEl: 'image-tool__image-picture',
      caption: 'image-tool__caption',
    };
  };

  /**
   * Ui statuses:
   * - empty
   * - uploading
   * - filled
   *
   * @returns {{EMPTY: string, UPLOADING: string, FILLED: string}}
   */
  static get status() {
    return {
      EMPTY: 'empty',
      UPLOADING: 'loading',
      FILLED: 'filled',
    };
  }

  /**
   * Renders tool UI
   *
   * @param {ImageToolData} toolData - saved tool data
   * @returns {Element}
   */
  render(toolData) {
    if (!toolData.file || Object.keys(toolData.file).length === 0) {
      this.toggleStatus(Ui.status.EMPTY);
    } else {
      this.toggleStatus(Ui.status.UPLOADING);
    }

    return this.nodes.wrapper;
  }

  /**
   * Creates upload-file button
   *
   * @returns {Element}
   */
  createFileButton() {
    const button = make('div', [ this.CSS.button ]);

    button.innerHTML = this.config.buttonContent || `${buttonIcon} ${this.api.i18n.t('Select an Image')}`;

    button.addEventListener('click', () => {
      this.onSelectFile();
    });

    return button;
  }

  /**
   * Shows uploading preloader
   *
   * @param {string} src - preview source
   * @returns {void}
   */
  showPreloader(src) {
    this.nodes.imagePreloader.style.backgroundImage = `url(${src})`;

    this.toggleStatus(Ui.status.UPLOADING);
  }

  /**
   * Hide uploading preloader
   *
   * @returns {void}
   */
  hidePreloader() {
    this.nodes.imagePreloader.style.backgroundImage = '';
    this.toggleStatus(Ui.status.EMPTY);
  }

  /**
   * Shows an image
   *
   * @param {string} url - image source
   * @returns {void}
   */
  fillImage(url) {
    /**
     * Check for a source extension to compose element correctly: video tag for mp4, audio tag for mp3, img — for others
     */
    let tag = 'IMG';

    if (/\.mp4$/.test(url)) {
      tag = 'VIDEO';
    }
    if (/\.mp3$/.test(url)) {
      tag = 'AUDIO';
    }

    const attributes = {
      src: url,
    };

    if (this.optimizeImages) {
      const srcSet = [640, 750, 828, 1080].map((width) => {
        const resizedUrl = getResizedUrl(url, {
          resize: {
            width,
            fit: 'cover',
          },
        });

        return `${resizedUrl} ${width}w`;
      }).join(', ');

      attributes.srcset = srcSet;
      attributes.sizes = '100vw';
    }

    /**
     * We use eventName variable because IMG and VIDEO tags have different event to be called on source load
     * - IMG: load
     * - VIDEO: loadeddata
     *
     * @type {string}
     */
    let eventName = 'load';

    /**
     * Update attributes and eventName if source is a mp4 video
     */
    if (tag === 'VIDEO') {
      /**
       * Add attributes for playing mp4
       *
       * @type {boolean}
       */

      attributes.playsinline = true;
      attributes.controls = true;

      /**
       * Change event to be listened
       *
       * @type {string}
       */
      eventName = 'loadeddata';
    }

    /**
     * Update attributes and eventName if source is a mp3 audio
     */
    if (tag === 'AUDIO') {
      /**
       * Add attributes for playing muted mp3
       *
       * @type {boolean}
       */
      attributes.controls = true;

      /**
       * Change event to be listened
       *
       * @type {string}
       */
      eventName = 'loadeddata';
    }

    /**
     * Compose tag with defined attributes
     *
     * @type {Element}
     */
    this.nodes.imageEl = make(tag, this.CSS.imageEl, attributes);

    /**
     * Add load event listener
     */
    this.nodes.imageEl.addEventListener(eventName, () => {
      this.toggleStatus(Ui.status.FILLED);

      /**
       * Preloader does not exists on first rendering with presaved data
       */
      if (this.nodes.imagePreloader) {
        this.nodes.imagePreloader.style.backgroundImage = '';
      }
    });

    this.nodes.imageContainer.appendChild(this.nodes.imageEl);
  }

  /**
   * Shows caption input
   *
   * @param {string} text - caption text
   * @returns {void}
   */
  fillCaption(text) {
    if (text) {
      if (this.nodes.caption) {
        if (this.appendCaptionOnDemand) {
          this.nodes.wrapper.appendChild(this.nodes.caption);
          this.appendCaptionOnDemand = false;
        }
        this.nodes.caption.innerHTML = text;
      }
    }
  }

  /**
   * Changes UI status
   *
   * @param {string} status - see {@link Ui.status} constants
   * @returns {void}
   */
  toggleStatus(status) {
    for (const statusType in Ui.status) {
      if (Object.prototype.hasOwnProperty.call(Ui.status, statusType)) {
        this.nodes.wrapper.classList.toggle(`${this.CSS.wrapper}--${Ui.status[statusType]}`, status === Ui.status[statusType]);
      }
    }
  }

  /**
   * Apply visual representation of activated tune
   *
   * @param {string} tuneName - one of available tunes {@link Tunes.tunes}
   * @param {boolean} status - true for enable, false for disable
   * @returns {void}
   */
  applyTune(tuneName, status) {
    this.nodes.wrapper.classList.toggle(`${this.CSS.wrapper}--${tuneName}`, status);
  }
}

/**
 * Helper for making Elements with attributes
 *
 * @param  {string} tagName           - new Element tag name
 * @param  {Array|string} classNames  - list or name of CSS class
 * @param  {object} attributes        - any attributes
 * @returns {Element}
 */
export const make = function make(tagName, classNames = null, attributes = {}) {
  const el = document.createElement(tagName);

  if (Array.isArray(classNames)) {
    el.classList.add(...classNames);
  } else if (classNames) {
    el.classList.add(classNames);
  }

  for (const attrName in attributes) {
    el[attrName] = attributes[attrName];
  }

  return el;
};

const cloudfrontHostname = 'https://d2obrjcl8a4u8e.cloudfront.net';
const s3Hostname = 'ntmg-media.s3.us-west-1.amazonaws.com';
const s3BucketName = 'ntmg-media';

// type ImageEditRequest = {
//   resize: {
//     height?: number;
//     width?: number;
//     fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
//   };
// };

const getResizedUrl = (originalImageUrl, imageEditRequest) => {
  if (!originalImageUrl) {
    return '';
  }

  if (!originalImageUrl.includes(s3Hostname)) {
    return originalImageUrl;
  }

  const parts = originalImageUrl.split(s3Hostname + '/');

  if (parts.length !== 2) {
    return originalImageUrl;
  }

  const key = parts[1]
    .split('/')
    .map((pathPart) => decodeURIComponent(pathPart))
    .join('/');
  const imageRequest = {
    bucket: s3BucketName,
    key,
    edits: imageEditRequest,
  };

  return `${cloudfrontHostname}/${base64FromByteArray(
    Uint8Array.from(new TextEncoder().encode(JSON.stringify(imageRequest)))
  )}`;
};
