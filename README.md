# Outfit360 - Privacy-Conscious Fashion Viewer

Outfit360 is a modern web application that transforms simple clothing videos into interactive, privacy-conscious rotating displays. Perfect for online sellers, boutiques, and fashion enthusiasts who want to showcase their items professionally while maintaining privacy.

## Features

- **Video to Interactive Display**: Convert 5-10 second videos into smooth, rotating product views
- **Privacy Protection**:
  - Automatic face detection and blurring
  - Background removal/blurring to maintain focus on the clothing
- **User-Friendly Interface**:
  - Simple drag-and-drop video upload
  - Customizable privacy settings
  - Mobile-responsive design
- **Professional Output**:
  - High-quality interactive viewer
  - Clean, distraction-free presentation
  - Easy sharing options

## Technology Stack

- **Frontend**:
  - Next.js 14
  - TypeScript
  - Tailwind CSS
  - React
- **Machine Learning**:
  - Face detection using TensorFlow.js MediaPipe Face Detector
  - Image processing using Sharp and Canvas API
- **Video Processing**:
  - FFmpeg for frame extraction and video handling

### Future Improvements

The current implementation uses basic background blurring through Sharp. For enhanced background handling, we plan to implement one of these state-of-the-art background segmentation models:
- [U²Net](https://github.com/xuebinqin/U-2-Net) - Highly accurate, better for detailed edges
- [MODNet](https://github.com/ZHKKKe/MODNet) - Faster, better for real-time processing

Both options would provide true background removal/replacement capabilities rather than just blurring.

## Getting Started

### Prerequisites

- Node.js (version 18.18.0 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/outfit360.git
   cd outfit360
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Usage

1. Record a video of your clothing item with a 360° rotation (5-10 seconds)
2. Upload the video through the web interface
3. Choose your privacy settings:
   - Enable/disable face blurring
   - Enable/disable background blurring
4. Process the video
5. Share your interactive display

## Contributing

We welcome contributions! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Face Detection: [TensorFlow.js MediaPipe Face Detector](https://github.com/tensorflow/tfjs-models/tree/master/face-detection)
- Image Processing: [Sharp](https://sharp.pixelplumbing.com/)
- Next.js Team for the amazing framework

## Contact

For any questions or feedback, please open an issue in the GitHub repository.
