import React, { Component } from 'react'
import throttle from 'lodash.throttle'
import PropTypes from 'prop-types'

export default class ScrollAnimation extends Component {
  constructor(props) {
    super(props)

    this.serverSide = typeof window === 'undefined'
    this.listener = throttle(this.handleScroll.bind(this), 50)

    this.visibility = {
      inViewport: false,
      onScreen: false,
    }

    this.state = {
      classes: 'animated',
      style: {
        animationDuration: `${this.props.duration}s`,
        opacity: this.props.initiallyVisible ? 1 : 0,
      },
    }
  }

  getElementTop(elm) {
    var yPos = 0

    while (elm && elm.offsetTop !== undefined && elm.clientTop !== undefined) {
      yPos += elm.offsetTop + elm.clientTop
      elm = elm.offsetParent
    }

    return yPos
  }

  getScrollPos() {
    if (this.scrollableParent.pageYOffset !== undefined) {
      return this.scrollableParent.pageYOffset
    }

    return this.scrollableParent.scrollTop
  }

  getScrollableParentHeight() {
    if (this.scrollableParent.innerHeight !== undefined) {
      return this.scrollableParent.innerHeight
    }

    return this.scrollableParent.clientHeight
  }

  getViewportTop() {
    return this.getScrollPos() + this.props.offset
  }

  getViewportBottom() {
    return this.getScrollPos() + this.getScrollableParentHeight() - this.props.offset
  }

  isInViewport(y) {
    return y >= this.getViewportTop()
      && y <= this.getViewportBottom()
  }

  isAboveViewport(y) {
    return y < this.getViewportTop()
  }

  isBelowViewport(y) {
    return y > this.getViewportBottom()
  }

  inViewport(elementTop, elementBottom) {
    return this.isInViewport(elementTop)
      || this.isInViewport(elementBottom)
      || this.isAboveViewport(elementTop) && this.isBelowViewport(elementBottom)
  }

  onScreen(elementTop, elementBottom) {
    return !this.isAboveScreen(elementBottom)
      && !this.isBelowScreen(elementTop)
  }

  isAboveScreen(y) {
    return y < this.getScrollPos()
  }

  isBelowScreen(y) {
    return y > this.getScrollPos() + this.getScrollableParentHeight()
  }

  getVisibility() {
    const elementTop = this.getElementTop(this.node) - this.getElementTop(this.scrollableParent)
    const elementBottom = elementTop + this.node.clientHeight
    const inViewport = this.inViewport(elementTop, elementBottom)

    return {
      aboveViewport: this.isAboveViewport(elementTop),
      belowViewport: this.isBelowViewport(elementTop),
      inViewport: inViewport,
      onScreen: this.onScreen(elementTop, elementBottom),
    }
  }

  componentDidMount() {
    if (!this.serverSide) {
      const parentSelector = this.props.scrollableParentSelector

      this.scrollableParent = parentSelector
        ? document.querySelector(parentSelector)
        : window

      if (this.scrollableParent && this.scrollableParent.addEventListener) {
        this.scrollableParent.addEventListener('scroll', this.listener)
      } else {
        console.warn(`Cannot find element by locator: ${this.props.scrollableParentSelector}`)
      }
      this.handleScroll()
    }
  }

  componentWillUnmount() {
    this.cleanup()
  }

  cleanup() {
    clearTimeout(this.delayedAnimationTimeout)
    clearTimeout(this.callbackTimeout)

    if (window && window.removeEventListener) {
      window.removeEventListener('scroll', this.listener)
    }
  }

  visibilityHasChanged(previousVis, currentVis) {
    return previousVis.inViewport !== currentVis.inViewport
      || previousVis.onScreen !== currentVis.onScreen
  }

  captureRef(ref) {
    if (ref) {
      this.node = ref.animateRef
        ? ref.animateRef
        : ref
    }
  }

  animate(animation, callback) {
    this.delayedAnimationTimeout = setTimeout(() => {
      this.animating = true

      this.setState({
        classes: `animated ${animation}`,
        style: {
          animationDuration: `${this.props.duration}s`,
        },
      })

      this.callbackTimeout = setTimeout(callback, this.props.duration * 1000)
    }, this.props.delay)
  }

  animateIn(callback) {
    this.animate(this.props.animateIn, () => {
      if (!this.props.animateOnce) {
        this.setState({
          style: {
            animationDuration: `${this.props.duration}s`,
            opacity: 1,
          },
        })
        this.animating = false
      }

      const vis = this.getVisibility()
      if (callback) {
        callback(vis)
      }
    })
  }

  animateOut(callback) {
    this.animate(this.props.animateOut, () => {
      this.setState({
        classes: 'animated',
        style: {
          animationDuration: `${this.props.duration}s`,
          opacity: 0,
        },
      })

      const vis = this.getVisibility()

      if (vis.inViewport && this.props.animateIn) {
        this.animateIn(this.props.afterAnimatedIn)
      } else {
        this.animating = false
      }

      if (callback) {
        callback(vis)
      }
    })
  }

  shouldNotAnimate(currentVis) {
    if (this.props.animateIn && this.props.animateOut) {
      return !currentVis.onScreen
    } else if (this.props.animateIn) {
      return !currentVis.onScreen && !currentVis.aboveViewport
    } else {
      return !currentVis.onScreen && !currentVis.belowViewport
    }
  }

  shouldAnimateIn(currentVis) {
    if (this.props.animateIn) {
      if (!this.props.animateOut) {
        return currentVis.inViewport || currentVis.aboveViewport
      } else {
        return currentVis.inViewport
      }
    }

    return false
  }

  shouldAnimateOut(currentVis) {
    if (this.props.animateOut && currentVis.onScreen && this.state.style.opacity === 1) {
      if (!this.props.animateIn) {
        return currentVis.inViewport || currentVis.belowViewport
      } else {
        return currentVis.inViewport
      }
    }

    return false
  }

  handleScroll() {
    if (!this.animating) {
      // Hack: There seems to be an issue with the way we are doing routing on the learn page, animations, and react component
      // lifecycle events.  For whatever reason, if you navigate quickly from lesson to lesson on the lesson overview page,
      // zombie event listeners are left hanging out observing scroll events.  This hack removes the zombie listeners when detected
      if (!this.node) {
        this.cleanup()
        return true
      }

      const currentVis = this.getVisibility()

      if (this.visibilityHasChanged(this.visibility, currentVis)) {
        clearTimeout(this.delayedAnimationTimeout)

        if (this.shouldNotAnimate(currentVis)) {
          this.setState({
            classes: 'animated',
            style: {
              animationDuration: `${this.props.duration}s`,
              opacity: this.props.initiallyVisible ? 1 : 0,
            },
          })
        } else if (this.shouldAnimateIn(currentVis)) {
          this.animateIn(this.props.afterAnimatedIn)
        } else if (this.shouldAnimateOut(currentVis)) {
          this.animateOut(this.props.afterAnimatedOut)
        }

        this.visibility = currentVis
      }
    }
  }

  renderChild(child, classes, index = 0) {
    const { initiallyVisible, keepStructure, siblingDelay } = this.props
    const  delay = siblingDelay * index

    const style = Object.assign(
      {},
      this.state.style,
      this.props.style, { animationDelay: `${delay}s` }
    )

    return (
      <AnimatedElement
        classes={classes}
        initiallyVisible={initiallyVisible}
        keepStructure={keepStructure}
        key={index}
        style={style}
      >
        {child}
      </AnimatedElement>
    )
  }

  renderChildren(classes, others) {
    const { children, siblingDelay } = this.props

    const elem = Array.isArray(others)
      ? others
      : children

    if (siblingDelay && Array.isArray(elem)) {
      return [ ...Array(elem.length).keys() ].map((siblingIndex) => {
        return this.renderChild(elem[siblingIndex], classes, siblingIndex)
      })
    } else {
      return this.renderChild(elem, classes)
    }
  }

  renderWrapped(classes) {
    return (
      <div ref={el => { this.node = el } }>
        {this.renderChildren(classes)}
      </div>
    )
  }

  renderStructure(classes) {
    const { children } = this.props

    if (React.Children.count(children) === 1) {
      return React.Children.map(
        children,
        child => React.cloneElement(
          child,
          { ref: this.captureRef.bind(this) },
          this.renderChildren(classes, child.props.children)
        )
      )
    }

    return this.renderWrapped(classes)
  }

  render() {
    const classes = this.props.className
      ? `${this.props.className} ${this.state.classes}`
      : this.state.classes

    if (this.props.keepStructure) {
      return this.renderStructure(classes)
    }

    return this.renderWrapped(classes)
  }
}

ScrollAnimation.defaultProps = {
  animateOnce: false,
  delay: 0,
  duration: 1,
  keepStructure: false,
  initiallyVisible: false,
  offset: 150,
  siblingDelay: 0,
}

ScrollAnimation.propTypes = {
  animateIn: PropTypes.string,
  animateOnce: PropTypes.bool,
  animateOut: PropTypes.string,
  className: PropTypes.string,
  delay: PropTypes.number,
  duration: PropTypes.number,
  initiallyVisible: PropTypes.bool,
  keepStructure: PropTypes.bool,
  offset: PropTypes.number,
  scrollableParentSelector: PropTypes.string,
  siblingDelay: PropTypes.number,
  style: PropTypes.object,
}

class AnimatedElement extends Component {
  constructor(props) {
    super(props)

    this.state = {
      hasAnimated: false,
    }
  }

  componentDidMount() {
    this.animationEndListener = this.ref.addEventListener('animationend', () => {
      if (this.ref) {
        this.setState({ hasAnimated: true })
      }
    })
  }

  componentWillUnmount() {
    if (this.ref && this.ref.removeEventListener) {
      this.ref.removeEventListener('animationend', this.animationEndListener)
    }
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.style.opacity === 0) {
      this.setState({ hasAnimated: false })
    }
  }

  captureRef(ref) {
    if (ref) {
      this.ref = ref.animateRef
        ? ref.animateRef
        : ref
    }
  }

  renderStructure({ style }) {
    const { children, classes } = this.props

    const elem = React.Children.map(
      children,
      child => React.cloneElement(
        child,
        { className: classes, style, ref: this.captureRef.bind(this) }
      )
    )

    return elem
  }

  renderWrapped({ style }) {
    const { children, classes } = this.props

    return (
      <div className={classes} style={style} ref={ref => this.ref = ref}>
        {children}
      </div>
    )
  }

  render() {
    const {
      initiallyVisible,
      keepStructure
    } = this.props

    const { hasAnimated } = this.state
    const propStyles = this.props.style

    const opacity = propStyles.animationDelay !== undefined && !initiallyVisible
      ? 0
      : propStyles.opacity

    const style = Object.assign(
      {},
      propStyles,
      { opacity: hasAnimated ? 1 : opacity }
    )

    if (keepStructure) {
      return this.renderStructure({ style })
    }

    return this.renderWrapped({ style })
  }
}

AnimatedElement.defaultProps = {
  keepStructure: false,
}

AnimatedElement.propTypes = {
  classes: PropTypes.string,
  keepStructure: PropTypes.bool,
  style: PropTypes.object,
}
