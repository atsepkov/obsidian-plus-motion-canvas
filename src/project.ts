import {makeProject} from '@motion-canvas/core';

import example from './scenes/example?scene';
import taskStatus from './scenes/task_status?scene';

export default makeProject({
  scenes: [example, taskStatus],
});
