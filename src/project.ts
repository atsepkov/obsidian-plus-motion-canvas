import {makeProject} from '@motion-canvas/core';

import tag from './scenes/tag?scene';
import task from './scenes/task?scene';

export default makeProject({
  scenes: [tag, task],
});
