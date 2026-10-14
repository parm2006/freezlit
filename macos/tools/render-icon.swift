import AppKit

guard CommandLine.arguments.count == 2 else { fatalError("Usage: swift render-icon.swift output.iconset") }
let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
let files: [(String, Int)] = [("icon_16x16.png",16),("icon_16x16@2x.png",32),
    ("icon_32x32.png",32),("icon_32x32@2x.png",64),("icon_128x128.png",128),
    ("icon_128x128@2x.png",256),("icon_256x256.png",256),("icon_256x256@2x.png",512),
    ("icon_512x512.png",512),("icon_512x512@2x.png",1024)]
let green = NSColor(srgbRed: 35/255, green: 99/255, blue: 73/255, alpha: 1)
let cream = NSColor(srgbRed: 246/255, green: 245/255, blue: 239/255, alpha: 1)
let tint = NSColor(srgbRed: 232/255, green: 238/255, blue: 230/255, alpha: 1)
for (name, size) in files {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    let context = NSGraphicsContext(bitmapImageRep: bitmap)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    context.imageInterpolation = .high
    let canvas = NSAffineTransform()
    canvas.translateX(by: 0, yBy: CGFloat(size))
    canvas.scaleX(by: CGFloat(size)/512, yBy: -CGFloat(size)/512)
    canvas.concat()
    for (angle, fill) in [(-18.0,cream),(0.0,tint),(18.0,cream)] {
        NSGraphicsContext.saveGraphicsState()
        let rotation = NSAffineTransform()
        rotation.translateX(by: 256, yBy: 400)
        rotation.rotate(byDegrees: CGFloat(angle))
        rotation.translateX(by: -256, yBy: -400)
        rotation.concat()
        let card = NSBezierPath(roundedRect: NSRect(x:155,y:82,width:202,height:324),xRadius:25,yRadius:25)
        card.lineWidth = 14
        card.lineJoinStyle = .round
        fill.setFill();green.setStroke();card.fill();card.stroke()
        if angle == 18 {
            let marks=NSBezierPath();marks.lineWidth=14;marks.lineCapStyle = .round
            marks.move(to:NSPoint(x:198,y:176));marks.line(to:NSPoint(x:314,y:176))
            marks.move(to:NSPoint(x:198,y:214));marks.line(to:NSPoint(x:276,y:214));marks.stroke()
        }
        NSGraphicsContext.restoreGraphicsState()
    }
    NSGraphicsContext.restoreGraphicsState()
    try bitmap.representation(using:.png,properties:[:])!.write(to:directory.appendingPathComponent(name))
}
print("Rendered Freezlit's splayed flashcards as a macOS iconset.")
