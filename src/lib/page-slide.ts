const easing = "cubic-bezier(0.22, 1, 0.36, 1)"
const duration = "450ms"

function move(name: string) {
  return { name, duration, easing, fillMode: "both" }
}

export const gallerySlide = {
  forwards: {
    old: move("slide-out-left"),
    new: move("slide-in-right"),
  },
  backwards: {
    old: move("slide-out-right"),
    new: move("slide-in-left"),
  },
}
