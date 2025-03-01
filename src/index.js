// cropper/cropper.js
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    /**
     * @type         number
     * @description  组件裁剪显示区域的最大比例，如果裁剪的图片过长，则做限制，默认最大宽高比例为 宽640 / 高960 (宽高比例)
     * @example 1    如果CROPPER_WIDTH宽度是720px，那么裁剪区域的高度也就是 CROPPER_WIDTH / cropperRatio 为 720px;
     */
    cropperRatio: {
      type: Number,
      value: 1,
    },

    /**
     * @type         string
     * @description  需要裁剪的图片地址
     */
    imageSrc: {
      type: String,
      value: '',
    },

    /**
     * @type         number
     * @description  裁剪区域的宽度
     */
    cropperWidth: {
      type: Number,
      value: 750,
    },

    /**
     * @type          number
     * @description   最小裁剪的范围
     */
    minCropperW: {
      type: Number,
      value: 50,
    },
  },

  /**
   * 组件的初始数据
   */
  data: {
    /**
     * @type         boolean
     * @description  图片在进行网络请求完成之后显示，showImg用于控制图片显示时机
     */
    showImg: false,

    /**
     * @
     */
    // 动态的宽高
    cropperW: null,
    cropperH: null,

    // 图片缩放值
    scaleP: 0,
    // 裁剪框 宽高
    cutL: 0,
    cutT: 0,
    cutB: 0,
    cutR: 0,

    qualityWidth: null,
    innerAspectRadio: null,

    filePath: null,
  },

  /**
   * 组件的方法列表
   */
  methods: {
    close() {
      wx.hideLoading()
      this.triggerEvent('close')
    },

    /**
     * 初始化变量信息
     */
    initStaticData() {
      this.drag = {
        CUT_L: null, // 初始化拖拽元素的left值
        CUT_T: null, // ...top值
        CUT_R: null, // ...right值
        CUT_B: null, // ...bottom值

        CUT_W: null, // 初始化拖拽元素的宽度
        CUT_H: null, // 初始化拖拽元素的高度

        IS_TOUCH_CONTENT: false, // 是否是可拖动的状态（拖拽裁剪框）
        IS_TOUCH_SIDE: false, // 是否可以拖拽边框
        IS_NO_DRAG: false,

        // 拖拽区域的时候设置
        TOUCH_OFFSET_X: null, // 手按下相对于裁剪框左边的距离
        TOUCH_OFFSET_Y: null, // 手按下相对于裁剪框上边的距离

        TOUCH_MAX_MOVE_SECTION_X: null, // 移动区域的时候移动的x方向最大区间
        TOUCH_MAX_MOVE_SECTION_Y: null, // 移动区域的时候移动的y方向最大区间

        MOVE_PAGE_X: null, // 手移动的时候x的位置
        MOVE_PAGE_Y: null, // 手移动的时候Y的位置

        SPACE_TOP_POSITION: null,
        SPACE_LEFT_POSITION: null,
        SPACE_RIGHT_POSITION: null,
        SPACE_BOTTOM_POSITION: null,
      }

      this.conf = {
        // 图片比例
        IMG_RATIO: null,

        // 图片实际宽高
        IMG_REAL_W: null, // 图片实际的宽度
        IMG_REAL_H: null, // 图片实际的高度

        // 裁剪除黑色区域以内的高度
        CROPPER_HEIGHT: null, // 图片背景区域宽度
        CROPPER_WIDTH: null, // 图标背景区域高度

        // 设置最小裁剪宽度高度
        CUT_MIN_W: null, // 最小限制多宽
        CUT_MIN_H: null, // 最小限制多高

        // 裁剪图片区域的信息
        // CROPPER_IMG_W: null,    // 也就是 data.cropperW
        // CROPPER_IMG_H: null,    // 也就是 data.cropperH

        // 移动的比例
        DRAG_MOVE_RATIO: 750 / wx.getWindowInfo().windowWidth, //移动时候的比例,

        INIT_DRAG_POSITION: 0, // 初始化屏幕宽度和裁剪区域的宽度之差，用于设置初始化裁剪的宽度
        DRAW_IMAGE_W: null, // 设置生成的图片宽度

        // 最大可显示得图片宽度，需要设定最大值，否则安卓部分机器会闪退, 控制qualityWidth的最大值
        MAX_QW: 2550,

        /**
         * 最小裁剪宽度  由于设置了裁剪的UI样式，裁剪的宽高必须要有最小宽度，这个宽度是裁剪长或者宽的最短一方的宽度
         * 如 400 200
         * 那么如果只能设置为100的时候
         * 那么最小缩放到200 100的效果，之后只能放大不能缩小
         */
        MIN_CROPPER_DIS: 100,
      }
    },

    /**
     * 选择本地图片
     * 基于底部中间的按钮的点击事件
     */
    getImage() {
      const _this = this
      wx.chooseMedia({
        count: 1, // 允许选择的文件数量
        mediaType: ['image'], // 只允许选择图片
        sourceType: ['album'], // 允许从相册或相机选择
        success: function (res) {
          if (res.tempFiles && res.tempFiles.length > 0) {
            _this.setData({
              isShowImg: false,
              filePath: res.tempFiles[0].tempFilePath, // 选择的图片路径
            })
            _this.loadImage(_this.data.filePath)
          }
        },
        fail: function (err) {
          console.error('图片选择失败', err)
        },
      })
    },

    /**
     * 初始化加载图片
     */
    loadImage(src) {
      const _this = this
      wx.showLoading({
        title: '图片加载中...',
      })

      // 获取 wx-cropper 容器的宽高
      const query = wx.createSelectorQuery().in(_this)
      query
        .select('#cropper-container')
        .boundingClientRect((rect) => {
          if (!rect) {
            console.error('获取 wx-cropper 容器尺寸失败')
            wx.hideLoading()
            return
          }
          let { width: containerW, height: containerH } = rect
          console.log('容器的宽', containerW, '容器的高', containerH)
          wx.getImageInfo({
            src: src || this.properties.imageSrc,
            success: function (res) {
              console.log('图片真实的宽高', res.width, res.height)

              // 记录图片原始宽高
              _this.conf.IMG_REAL_W = res.width
              _this.conf.IMG_REAL_H = res.height
              _this.conf.IMG_RATIO = Number(
                (_this.conf.IMG_REAL_W / _this.conf.IMG_REAL_H).toFixed(5)
              )
              let cropperW, 
                cropperH
              // .....
              if (containerW / containerH >= _this.conf.IMG_RATIO) {
                // 图片的高相对更大，以高为基准
                cropperH = containerH
                cropperW = Math.ceil(
                  (containerH / _this.conf.IMG_REAL_H) * _this.conf.IMG_REAL_W
                )
              } else {
                // 图片的宽相对更大，以宽为基准
                cropperW = containerW
                cropperH = Math.ceil(
                  (containerW / _this.conf.IMG_REAL_W) * _this.conf.IMG_REAL_H
                )
              }
              console.log('cropperW', cropperW, 'cropperH', cropperH)
              // 计算缩放比
              const scaleP = Number(
                (_this.conf.IMG_REAL_W / cropperW).toFixed(5)
              )

              // 限制最大质量宽度
              const qualityWidth = Math.min(
                _this.conf.IMG_REAL_W,
                _this.conf.MAX_QW
              )

              console.log('计算出的裁剪区域：', cropperW, cropperH)
              const p = _this.initPosition()

              _this.setData({
                cropperW,
                cropperH,
                cutL: p.left,
                cutT: p.top,
                cutR: p.right,
                cutB: p.bottom,
                scaleP,
                qualityWidth,
                innerAspectRadio: _this.conf.IMG_RATIO,
                filePath: res.path,
                showImg: true,
              })

              // 设置裁剪最小限制
              _this.setMinCutInfo()

              wx.hideLoading()
            },
            fail(err) {
              console.error('获取图片信息失败', err)
              wx.hideLoading()
            },
          })
        })
        .exec()
    },

    /**
     * 点击完成裁剪图片并返回图片信息
     * width 宽度
     * height  高度
     * url  图片的临时存储地址
     */
    getImageInfo() {
      const _this = this
      //   wx.showLoading({
      //     title: '图片生成中...',
      //   })

      this.drag.IS_NO_DRAG = true

      // 获取 Canvas 组件
      wx.createSelectorQuery()
        .in(this)
        .select('#cropperCanvas')
        .node()
        .exec((res) => {
          if (!res[0] || !res[0].node) {
            wx.hideLoading()
            return
          }

          const canvas = res[0].node
          const ctx = canvas.getContext('2d')

          const w = this.data.qualityWidth
          const h = Math.ceil(
            this.data.qualityWidth / this.data.innerAspectRadio
          )

          // 设置 Canvas 大小
          canvas.width = w
          canvas.height = h

          // 加载图片
          const img = canvas.createImage()
          img.src = this.data.filePath
          img.onload = () => {
            ctx.drawImage(img, 0, 0, w, h)

            // 计算裁剪参数
            const canvasW = Math.ceil(
              ((this.data.cropperW - this.data.cutL - this.data.cutR) /
                this.data.cropperW) *
                w
            )
            const canvasH = Math.ceil(
              ((this.data.cropperH - this.data.cutT - this.data.cutB) /
                this.data.cropperH) *
                h
            )
            const canvasL = Math.ceil(
              (this.data.cutL / this.data.cropperW) * w
            )
            const canvasT = Math.ceil(
              (this.data.cutT / this.data.cropperH) * h
            )
            // 截取裁剪区域
            wx.canvasToTempFilePath({
              x: canvasL,
              y: canvasT,
              width: canvasW,
              height: canvasH,
              destWidth: canvasW,
              destHeight: canvasH,
              quality: 1,
              canvas,
              success: function (res) {
                console.log('res', res)
                const img = {
                  path: res.tempFilePath,
                  width: canvasW,
                  height: canvasH,
                }
                _this.triggerEvent('close', img)
              },
              complete: function () {
                wx.hideLoading()
                _this.drag.IS_NO_DRAG = false
              },
            })
          }

          img.onerror = (err) => {
            console.error('图片加载失败', err)
            wx.hideLoading()
          }
        })
    },

    /**
     * 设置最小裁剪宽度高度限制
     */
    setMinCutInfo() {
      this.conf.CUT_MIN_W = this.properties.minCropperW
      this.conf.CUT_MIN_H = this.properties.minCropperW
    },

    /**
     * 初始化裁剪位置
     * @return 返回裁剪的left, right, top bottom的值
     */
    initPosition() {
      const left = 0,
        right = 0,
        top = 0,
        bottom = 0

      // 如果图片宽度小于高度 (竖向)
      if (this.properties.cropperRatio > this.conf.IMG_RATIO) {
        this.conf.CROPPER_WIDTH =
          (this.properties.cropperWidth / this.properties.cropperRatio) *
          this.conf.IMG_RATIO
        this.conf.CROPPER_HEIGHT =
          this.properties.cropperWidth / this.properties.cropperRatio
      } else {
        this.conf.CROPPER_WIDTH = this.properties.cropperWidth
        this.conf.CROPPER_HEIGHT =
          this.properties.cropperWidth / this.conf.IMG_RATIO
      }
      // 定义四个位置
      return { left, right, top, bottom }
    },

    /**
     * 裁剪框的拖动事件
     */
    contentDragStart(e) {
      if (this.drag.IS_NO_DRAG) return
      this.drag.IS_TOUCH_CONTENT = true

      this.drag.TOUCH_OFFSET_X =
        e.touches[0].pageX * this.conf.DRAG_MOVE_RATIO - this.data.cutL
      this.drag.TOUCH_OFFSET_Y =
        e.touches[0].pageY * this.conf.DRAG_MOVE_RATIO - this.data.cutT

      /**
       * 获取可移动的最大值 xy方向
       */
      const cc = this.cropperCurrentInfo()
      this.drag.TOUCH_MAX_MOVE_SECTION_X = cc.x
      this.drag.TOUCH_MAX_MOVE_SECTION_Y = cc.y
    },

    /**
     * 获取裁剪区域信息
     */
    cropperCurrentInfo() {
      const x = this.data.cutL + this.data.cutR
      const y = this.data.cutT + this.data.cutB

      // 获取拖拽元素的宽高
      this.drag.CUT_W = this.data.cropperW - x
      this.drag.CUT_H = this.data.cropperH - y

      // 返回x, y
      return {
        x,
        y,
      }
    },

    /**
     * 裁剪框拖动
     */
    contentDragMove(e) {
      if (this.drag.IS_NO_DRAG) return
      if (!this.drag.IS_TOUCH_CONTENT) return
      const MOVE_X =
        e.touches[0].pageX * this.conf.DRAG_MOVE_RATIO -
        this.drag.TOUCH_OFFSET_X
      const MOVE_Y =
        e.touches[0].pageY * this.conf.DRAG_MOVE_RATIO -
        this.drag.TOUCH_OFFSET_Y

      const drag_x = Math.min(
        this.drag.TOUCH_MAX_MOVE_SECTION_X,
        Math.max(0, MOVE_X)
      )
      const drag_y = Math.min(
        this.drag.TOUCH_MAX_MOVE_SECTION_Y,
        Math.max(0, MOVE_Y)
      )

      this.setData({
        cutL: Math.ceil(drag_x),
        cutR: Math.ceil(this.data.cropperW - this.drag.CUT_W - drag_x),
        cutT: Math.ceil(drag_y),
        cutB: Math.ceil(this.data.cropperH - this.drag.CUT_H - drag_y),
      })

      // 需要初始化
      this.drag.TOUCH_OFFSET_X =
        e.touches[0].pageX * this.conf.DRAG_MOVE_RATIO - this.data.cutL
      this.drag.TOUCH_OFFSET_Y =
        e.touches[0].pageY * this.conf.DRAG_MOVE_RATIO - this.data.cutT
    },

    /**
     * 裁剪框拖动结束
     */
    contentTouchEnd() {
      this.drag.IS_TOUCH_CONTENT = false
    },

    /**
     * 裁剪框4个方向的拖拽
     */
    sideDragStart(e) {
      if (this.drag.IS_NO_DRAG) return
      this.drag.IS_TOUCH_SIDE = true
      this.drag.MOVE_PAGE_X = e.touches[0].pageX
      this.drag.MOVE_PAGE_Y = e.touches[0].pageY

      // 初始化设置
      this.conf.CUT_T = this.data.cutT
      this.conf.CUT_L = this.data.cutL
      this.conf.CUT_R = this.data.cutR
      this.conf.CUT_B = this.data.cutB

      // 初始化最大移动区域
      this.drag.SPACE_TOP_POSITION =
        this.conf.CROPPER_HEIGHT - this.conf.CUT_B - this.conf.CUT_MIN_H
      this.drag.SPACE_BOTTOM_POSITION =
        this.conf.CROPPER_HEIGHT - this.conf.CUT_T - this.conf.CUT_MIN_H
      this.drag.SPACE_RIGHT_POSITION =
        this.conf.CROPPER_WIDTH - this.conf.CUT_L - this.conf.CUT_MIN_W
      this.drag.SPACE_LEFT_POSITION =
        this.conf.CROPPER_WIDTH - this.conf.CUT_R - this.conf.CUT_MIN_W
    },

    /**
     *  拖拽中
     */
    sideDragMove(e) {
      if (this.drag.IS_NO_DRAG) return
      if (!this.drag.IS_TOUCH_SIDE) return
      const type = e.target.dataset.drag
      this.sideDragMoveDefault(e, type)
    },

    /**
     * 拖拽结束
     */
    sideDragEnd() {
      this.drag.IS_TOUCH_SIDE = false
    },

    /**
     * 非等比例拖拽的操作
     */
    sideDragMoveDefault(e, type) {
      const xLength =
        (e.touches[0].pageX - this.drag.MOVE_PAGE_X) *
        this.conf.DRAG_MOVE_RATIO
      const yLength =
        (e.touches[0].pageY - this.drag.MOVE_PAGE_Y) *
        this.conf.DRAG_MOVE_RATIO

      switch (type) {
        case 'leftBottom':
          let leftBottomL = this.conf.CUT_L + xLength
          leftBottomL = leftBottomL <= 0 ? 0 : leftBottomL
          leftBottomL = Math.ceil(
            leftBottomL >= this.drag.SPACE_LEFT_POSITION
              ? this.drag.SPACE_LEFT_POSITION
              : leftBottomL
          )

          let leftBottomB = this.conf.CUT_B - yLength
          leftBottomB = leftBottomB <= 0 ? 0 : leftBottomB
          leftBottomB = Math.ceil(
            leftBottomB >= this.drag.SPACE_BOTTOM_POSITION
              ? this.drag.SPACE_BOTTOM_POSITION
              : leftBottomB
          )
          this.setData({
            cutB: leftBottomB,
            cutL: leftBottomL,
          })
          break
        case 'leftTop':
          let leftTopL = this.conf.CUT_L + xLength
          leftTopL = leftTopL <= 0 ? 0 : leftTopL
          leftTopL = Math.ceil(
            leftTopL >= this.drag.SPACE_LEFT_POSITION
              ? this.drag.SPACE_LEFT_POSITION
              : leftTopL
          )

          let leftTopT = this.conf.CUT_T + yLength
          leftTopT = leftTopT <= 0 ? 0 : leftTopT
          leftTopT = Math.ceil(
            leftTopT >= this.drag.SPACE_TOP_POSITION
              ? this.drag.SPACE_TOP_POSITION
              : leftTopT
          )
          this.setData({
            cutT: leftTopT,
            cutL: leftTopL,
          })
          break
        case 'rightTop':
          let rightTopR = this.conf.CUT_R - xLength
          rightTopR = rightTopR <= 0 ? 0 : rightTopR
          rightTopR = Math.ceil(
            rightTopR >= this.drag.SPACE_RIGHT_POSITION
              ? this.drag.SPACE_RIGHT_POSITION
              : rightTopR
          )
          let rightTopT = this.conf.CUT_T + yLength
          rightTopT = rightTopT <= 0 ? 0 : rightTopT
          rightTopT = Math.ceil(
            rightTopT >= this.drag.SPACE_TOP_POSITION
              ? this.drag.SPACE_TOP_POSITION
              : rightTopT
          )
          this.setData({
            cutT: rightTopT,
            cutR: rightTopR,
          })
          break
        case 'rightBottom':
          let rightBottomR = this.conf.CUT_R - xLength
          rightBottomR = rightBottomR <= 0 ? 0 : rightBottomR
          rightBottomR = Math.ceil(
            rightBottomR >= this.drag.SPACE_RIGHT_POSITION
              ? this.drag.SPACE_RIGHT_POSITION
              : rightBottomR
          )

          let rightBottomB = this.conf.CUT_B - yLength
          rightBottomB = rightBottomB <= 0 ? 0 : rightBottomB
          rightBottomB = Math.ceil(
            rightBottomB >= this.drag.SPACE_BOTTOM_POSITION
              ? this.drag.SPACE_BOTTOM_POSITION
              : rightBottomB
          )
          this.setData({
            cutB: rightBottomB,
            cutR: rightBottomR,
          })
          break
        default:
          break
      }
    },
  },

  created: function () {
    this.initStaticData()
    // console.log(this.drag)
    // console.log(this.conf)
    // console.log(this.data)
    // console.log(this.conf.DRAG_MOVE_RATIO)
  },

  attached: function () {
    // console.log('attached')
    this.loadImage()
  },

  ready: function () {
    // console.log('ready')
  },

  moved: function () {
    // console.log('moved')
  },

  detached: function () {
    // console.log('detached')
  },
})
